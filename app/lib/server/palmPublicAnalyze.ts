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
import { durationBucket, PalmGateUnavailable, type PalmEventName, type PalmPublicStore } from './palmPublicGate';
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
};

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
  const event = (name: PalmEventName, errorCode: string | null) =>
    store.recordEvent(sessionKey, {
      eventId: crypto.randomUUID(), event: name, supplementVersion: 1,
      durationBucket: durationBucket(now() - started), errorCode,
    }, config.limits.eventsPerSessionDaily).catch(() => undefined); // analytics 실패는 응답을 막지 않는다

  try {
    const remaining = () => deps.requestTimeoutMs - (now() - started);
    const prepared = await readAndPreparePalmUpload(req, remaining);

    let reservation;
    try {
      reservation = await store.reserve({
        kind: 'public',
        sessionKey,
        requestId,
        payloadFingerprint: palmImageFingerprint(config.sessionSecret, session.sessionId, prepared.bytes),
        ipKey: palmIpKey(config.sessionSecret, ip, now()),
        limits: config.limits,
      });
    } catch {
      return palmFail(503, 'UNAVAILABLE');
    }
    switch (reservation.outcome) {
      case 'rate-limited': return palmFail(429, 'RATE_LIMITED', reservation.retryAfterSeconds);
      case 'duplicate-image': return palmFail(409, 'DUPLICATE_IMAGE', reservation.retryAfterSeconds);
      case 'request-conflict': return palmFail(409, 'REQUEST_CONFLICT');
      case 'duplicate-request': return palmFail(409, 'DUPLICATE_REQUEST', undefined, reservation.status); // 상태만, 재추론 없음
      case 'reserved': break;
    }

    try {
      if (!(await store.markStarted(sessionKey, requestId))) throw new PalmGateUnavailable();
    } catch {
      await store.finalize(sessionKey, requestId, 'failed', 'UNAVAILABLE').catch(() => undefined);
      return palmFail(503, 'UNAVAILABLE');
    }

    const providerTimeoutMs = Math.min(deps.providerTimeoutMs, remaining());
    if (providerTimeoutMs <= 0) {
      await store.finalize(sessionKey, requestId, 'failed', 'PROVIDER_TIMEOUT').catch(() => undefined);
      await event('palm_error', 'PROVIDER_TIMEOUT');
      return palmFail(504, 'PROVIDER_TIMEOUT');
    }
    try {
      const bundle = await extractPalmObservation(prepared, deps.createProvider(config.apiKey), {
        signal: req.signal, metadata: deps.metadata, providerTimeoutMs,
      });
      await store.finalize(sessionKey, requestId, 'completed', null).catch(() => undefined);
      await event(bundle.quality.usability === 'unusable' ? 'palm_unusable' : 'palm_success', null);
      return palmJson(200, { ok: true, bundle });
    } catch (e) {
      const code = palmProviderFailureCode(e) ?? 'UNAVAILABLE';
      // timeout은 provider가 이미 처리·과금했을 수 있다 → uncertain (환불·자동 재호출 없음)
      await store.finalize(sessionKey, requestId, code === 'PROVIDER_TIMEOUT' ? 'uncertain' : 'failed', code).catch(() => undefined);
      await event('palm_error', code);
      throw e;
    }
  } catch (e) {
    return palmFailureResponse(e);
  }
}
