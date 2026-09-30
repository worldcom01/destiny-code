import 'server-only';
import {
  extractPalmObservation,
  palmFail,
  palmFailureResponse,
  palmJson,
  palmProviderFailureCode,
  readAndPreparePalmUpload,
  type PalmExtractionMetadata,
} from './palmExtraction';
import {
  checkPalmOrigin,
  isAcceptedPalmNotice,
  isPalmCsrfValid,
  isPalmRequestId,
  palmImageFingerprint,
  palmIpKey,
  palmSessionKey,
  PALM_CSRF_HEADER,
  PALM_NOTICE_HEADER,
  PALM_PUBLIC_REQUEST_ID_HEADER,
  PALM_SESSION_COOKIE,
  readCookie,
  readPalmPublicConfig,
  trustedClientIp,
  verifyPalmSessionCookie,
} from './palmPublicAccess';
import { durationBucket, palmWithin, PALM_DB_CALL_TIMEOUT_MS, type PalmEventName, type PalmPublicStore } from './palmPublicGate';
import type { PalmVisionProvider } from './palmVisionProvider';

// ── Palm Phase 1C: 공개 사용자 분기 (/api/palm/analyze, operator secret 헤더가 없는 요청) ──
// 순서: 설정(kill switch) → Origin/Sec-Fetch-Site → 서명 세션 → CSRF → request ID·처리 안내 버전
//       → 신뢰 IP → [여기까지 body를 읽지 않음] → 업로드 검증·준비 → session-bound fingerprint
//       → 공유 DB atomic 예약 (한도·중복·동시성) → provider-started → 관찰 추출 → finalize.
// 저장소 장애는 provider 호출 0회로 fail closed. 이미지·관찰·provider 원문은 DB/로그에 남기지 않는다.
// 기본 분석(analyzeDestiny)과 무관하다 — 이 경로는 관찰 bundle만 반환한다.

export type PalmPublicAnalyzeDeps = {
  env: Record<string, string | undefined>;
  createProvider: (apiKey: string) => PalmVisionProvider;
  createStore: (config: { supabaseUrl: string; supabaseServiceKey: string }) => Promise<PalmPublicStore>;
  metadata: PalmExtractionMetadata;
  requestTimeoutMs: number;
  providerTimeoutMs: number;
  now?: () => number;
  dbTimeoutMs?: number;          // 공유 DB 호출 1회 상한 (기본 2.5초)
  analyticsTimeoutMs?: number;   // analytics 기록 상한 (기본 1초, best-effort)
};

// 응답 상한: requestTimeoutMs(업로드+DB 예약+provider) + finalize 상한 + analytics 상한.
// 기본값 30초 + 2.5초 + 1초 = 33.5초 < route maxDuration 40초.
export const PALM_ANALYTICS_TIMEOUT_MS = 1_000;

export async function handlePalmPublicAnalyze(req: Request, deps: PalmPublicAnalyzeDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const config = readPalmPublicConfig(deps.env);
  if (!config.enabled) return palmFail(503, 'UNAVAILABLE');

  // ── body를 읽기 전 검증 ──
  if (checkPalmOrigin(req, config.origin) !== 'ok') return palmFail(403, 'ACCESS_DENIED');
  const session = verifyPalmSessionCookie(readCookie(req.headers.get('cookie'), PALM_SESSION_COOKIE), config.sessionSecret, now());
  if (!session) return palmFail(401, 'SESSION_REQUIRED');
  if (!isPalmCsrfValid(req.headers.get(PALM_CSRF_HEADER), config.sessionSecret, session.sessionId)) return palmFail(403, 'ACCESS_DENIED');
  const requestId = req.headers.get(PALM_PUBLIC_REQUEST_ID_HEADER);
  if (!isPalmRequestId(requestId) || !isAcceptedPalmNotice(req.headers.get(PALM_NOTICE_HEADER))) return palmFail(400, 'INVALID_REQUEST');
  const ip = trustedClientIp(req, config.trustedIpHeader);
  if (!ip) return palmFail(503, 'UNAVAILABLE'); // 신뢰 IP 없이는 공개 호출을 받지 않는다

  let store: PalmPublicStore;
  try {
    store = await deps.createStore(config);
  } catch {
    return palmFail(503, 'UNAVAILABLE');
  }
  const sessionKey = palmSessionKey(config.sessionSecret, session.sessionId);
  const dbMs = deps.dbTimeoutMs ?? PALM_DB_CALL_TIMEOUT_MS;
  // analytics: 짧은 상한 안에서만 기다리는 best-effort. 실패·지연은 응답을 막지 않고 기록이 빠질 수 있다.
  const event = (name: PalmEventName, errorCode: string | null) => palmWithin(
    store.recordEvent(sessionKey, {
      eventId: crypto.randomUUID(), event: name, supplementVersion: 1,
      durationBucket: durationBucket(now() - started), errorCode,
    }, config.limits.eventsPerSessionDaily),
    deps.analyticsTimeoutMs ?? PALM_ANALYTICS_TIMEOUT_MS,
  );
  // provider 이후 finalize: 상한 안에서 한 번만 시도한다. 확인하지 못하면 원장은 provider-started로 남고
  // lease(120초) 만료 시 SQL이 'uncertain'으로 바꾼다 — 예산 환불·provider 재호출 없음 (보수적 회계).
  const finalize = (status: 'completed' | 'failed' | 'uncertain', code: string | null) =>
    palmWithin(store.finalize(sessionKey, requestId, status, code), dbMs);

  try {
    const remaining = () => deps.requestTimeoutMs - (now() - started);
    const prepared = await readAndPreparePalmUpload(req, remaining);

    // provider 이전 DB 호출도 상한 안에서만 — 지연·오류면 provider 호출 0회로 503 (fail closed)
    const reserved = await palmWithin(store.reserve({
      kind: 'public',
      sessionKey,
      requestId,
      payloadFingerprint: palmImageFingerprint(config.sessionSecret, session.sessionId, prepared.bytes),
      ipKey: palmIpKey(config.sessionSecret, ip, now()),
      limits: config.limits,
    }), Math.min(dbMs, Math.max(0, remaining())));
    if (!reserved.ok) return palmFail(503, 'UNAVAILABLE');
    const reservation = reserved.value;
    switch (reservation.outcome) {
      case 'rate-limited': return palmFail(429, 'RATE_LIMITED', reservation.retryAfterSeconds);
      case 'duplicate-image': return palmFail(409, 'DUPLICATE_IMAGE', reservation.retryAfterSeconds);
      case 'request-conflict': return palmFail(409, 'REQUEST_CONFLICT');
      case 'duplicate-request': return palmFail(409, 'DUPLICATE_REQUEST', undefined, reservation.status); // 상태만, 재추론 없음
      case 'reserved': break;
    }

    const started_ = await palmWithin(store.markStarted(sessionKey, requestId), Math.min(dbMs, Math.max(0, remaining())));
    if (!started_.ok || !started_.value) {
      await finalize('failed', 'UNAVAILABLE'); // provider 호출 전 — 실패로 닫는다 (확인 못 하면 lease 만료로 정리)
      return palmFail(503, 'UNAVAILABLE');
    }

    const providerTimeoutMs = Math.min(deps.providerTimeoutMs, remaining());
    if (providerTimeoutMs <= 0) {
      await finalize('failed', 'PROVIDER_TIMEOUT');
      await event('palm_error', 'PROVIDER_TIMEOUT');
      return palmFail(504, 'PROVIDER_TIMEOUT');
    }
    let bundle;
    try {
      bundle = await extractPalmObservation(prepared, deps.createProvider(config.apiKey), {
        signal: req.signal, metadata: deps.metadata, providerTimeoutMs,
      });
    } catch (e) {
      const code = palmProviderFailureCode(e) ?? 'UNAVAILABLE';
      // timeout은 provider가 이미 처리·과금했을 수 있다 → uncertain (환불·자동 재호출 없음)
      await finalize(code === 'PROVIDER_TIMEOUT' ? 'uncertain' : 'failed', code);
      await event('palm_error', code);
      throw e;
    }
    // 유료 관찰은 이미 받았다: finalize·analytics가 늦거나 실패해도 결과를 돌려준다 (재호출 없음)
    await finalize('completed', null);
    await event(bundle.quality.usability === 'unusable' ? 'palm_unusable' : 'palm_success', null);
    return palmJson(200, { ok: true, bundle });
  } catch (e) {
    return palmFailureResponse(e);
  }
}
