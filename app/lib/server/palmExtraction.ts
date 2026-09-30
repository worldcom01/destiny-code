import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  parsePalmObservationBundle,
  PalmObservationContractError,
  type PalmObservationBundle,
} from '../palmObservation';
import {
  isOperatorSecretValid,
  readPalmExtractionConfig,
  PALM_REQUEST_ID_HEADER,
  PALM_SECRET_HEADER,
  type PalmRequestGate,
} from './palmAccess';
import { PALM_ALLOWED_MIME, PALM_IMAGE_LIMITS, PalmImageError, preparePalmImage, readBoundedBody } from './palmImage';
import { PalmProviderError, type PalmVisionProvider, type PreparedPalmImage } from './palmVisionProvider';
import type { PalmPublicLimits } from './palmPublicAccess';
import { palmWithin, PALM_DB_CALL_TIMEOUT_MS, type PalmPublicStore } from './palmPublicGate';

// ── Palm Phase 1B: provider 응답 → 검증된 PalmObservationBundle ─────────────
// provider의 unknown 응답 → 전송 형식 확인(observation·quality 두 필드) → 서버 소유 metadata 조립
// → parsePalmObservationBundle() → 신뢰할 수 있는 bundle. 의미 검증은 parser 한 곳뿐이다.
// Evidence 생성·기존 분석·저장은 호출하지 않는다.

export type PalmExtractionMetadata = PalmObservationBundle['extraction'];

export async function extractPalmObservation(
  image: PreparedPalmImage,
  provider: PalmVisionProvider,
  options: { signal: AbortSignal; metadata: PalmExtractionMetadata; providerTimeoutMs: number },
): Promise<PalmObservationBundle> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), options.providerTimeoutMs);
  const signal = AbortSignal.any([options.signal, deadline.signal]);
  const aborted = new Promise<never>((_, reject) => {
    const fail = () => reject(new PalmProviderError('timeout'));
    if (signal.aborted) fail(); else signal.addEventListener('abort', fail, { once: true });
  });
  let raw: unknown;
  try {
    raw = await Promise.race([provider.extract(image, { signal }), aborted]); // 자동 재시도 없음
  } catch (e) {
    if (e instanceof PalmProviderError) throw e;
    throw new PalmProviderError(signal.aborted ? 'timeout' : 'provider-error');
  } finally {
    clearTimeout(timer);
  }
  if (signal.aborted) throw new PalmProviderError('timeout'); // 늦게 도착한 결과는 버린다

  // 전송 형식 확인: 정확히 observation·quality 두 필드. 추가 필드를 지우고 통과시키지 않는다.
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new PalmProviderError('invalid-response');
  const keys = Object.keys(raw).sort();
  if (keys.length !== 2 || keys[0] !== 'observation' || keys[1] !== 'quality') throw new PalmProviderError('invalid-response');
  const payload = raw as { observation: unknown; quality: unknown };

  // version과 extraction은 모델 출력이 아니라 서버가 붙인다
  const candidate: unknown = { version: 1, observation: payload.observation, quality: payload.quality, extraction: options.metadata };
  try {
    return parsePalmObservationBundle(candidate);
  } catch (e) {
    if (e instanceof PalmObservationContractError) throw new PalmProviderError('invalid-response');
    throw e;
  }
}

// ── HTTP 경계 (app/api/palm/analyze/route.ts가 사용) ────────────────────────

export type PalmErrorCode =
  | 'ACCESS_DENIED' | 'UNAVAILABLE' | 'INVALID_IMAGE' | 'IMAGE_TOO_LARGE' | 'RATE_LIMITED'
  | 'PROVIDER_TIMEOUT' | 'PROVIDER_ERROR' | 'INVALID_PROVIDER_RESPONSE'
  // Phase 1C 공개 경로
  | 'SESSION_REQUIRED' | 'INVALID_REQUEST' | 'DUPLICATE_REQUEST' | 'REQUEST_CONFLICT' | 'DUPLICATE_IMAGE';

export type PalmExtractionResponse =
  | { ok: true; bundle: PalmObservationBundle }
  | { ok: false; error: { code: PalmErrorCode; retryAfterSeconds?: number; requestStatus?: string } };

export type PalmAnalyzeDeps = {
  env: Record<string, string | undefined>;
  createProvider: (apiKey: string) => PalmVisionProvider;
  gate: PalmRequestGate;
  metadata: PalmExtractionMetadata;
  requestTimeoutMs: number;
  providerTimeoutMs: number;
  // 공개 경로용 공유 저장소가 구성된 배포에서만 — 운영자 호출도 전역 provider 상한을 소모한다
  globalBudget?: { store: PalmPublicStore; limits: PalmPublicLimits };
};

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(status: number, body: PalmExtractionResponse, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

function fail(status: number, code: PalmErrorCode, retryAfterSeconds?: number, requestStatus?: string): Response {
  // 로그에는 정규화된 code만 남긴다 (이미지·응답·헤더·secret·IP·cookie 없음)
  if (status >= 500) console.warn(`[palm] ${code}`);
  const error = { code, ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}), ...(requestStatus ? { requestStatus } : {}) };
  return json(status, { ok: false, error }, retryAfterSeconds !== undefined ? { 'Retry-After': String(retryAfterSeconds) } : {});
}

const IMAGE_FAILURE: Record<PalmImageError['failure'], [number, PalmErrorCode]> = {
  unsupported: [415, 'INVALID_IMAGE'],
  invalid: [422, 'INVALID_IMAGE'],
  empty: [400, 'INVALID_IMAGE'],
  'upload-failed': [400, 'INVALID_IMAGE'],
  'too-large': [413, 'IMAGE_TOO_LARGE'],
};
const PROVIDER_FAILURE: Record<PalmProviderError['failure'], [number, PalmErrorCode]> = {
  timeout: [504, 'PROVIDER_TIMEOUT'],
  'provider-error': [503, 'PROVIDER_ERROR'],
  'invalid-response': [502, 'INVALID_PROVIDER_RESPONSE'],
};

// ── 공통 업로드 단계: operator·공개 경로가 같은 검증·deadline을 쓴다 ─────────────
// 헤더 검사 → deadline 안에서 bounded body 읽기 → preparePalmImage (MIME·signature·크기·해상도·EXIF·metadata 제거).
export class PalmUploadRejected extends Error {
  constructor(readonly status: number, readonly code: PalmErrorCode) {
    super(`palm upload: ${code}`);
    this.name = 'PalmUploadRejected';
  }
}

export async function readAndPreparePalmUpload(req: Request, remainingMs: () => number): Promise<PreparedPalmImage> {
  const encoding = req.headers.get('content-encoding');
  if (encoding && encoding.trim().toLowerCase() !== 'identity') throw new PalmUploadRejected(415, 'INVALID_IMAGE');
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!(PALM_ALLOWED_MIME as readonly string[]).includes(mime)) throw new PalmUploadRejected(415, 'INVALID_IMAGE');
  const declared = Number(req.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > PALM_IMAGE_LIMITS.maxInputBytes) throw new PalmUploadRejected(413, 'IMAGE_TOO_LARGE');

  // 느린 업로드도 전체 deadline에 포함된다. deadline·요청 취소 시 본문 reader를 취소하고,
  // 읽기가 실제로 끝난 뒤에만 다음 단계(또는 호출부 finally의 slot 해제)로 진행한다 — race로 먼저 반환하지 않는다.
  const uploadDeadline = new AbortController();
  const uploadTimer = setTimeout(() => uploadDeadline.abort(), Math.max(0, remainingMs()));
  let read: Uint8Array;
  try {
    read = await readBoundedBody(req.body, PALM_IMAGE_LIMITS.maxInputBytes, AbortSignal.any([req.signal, uploadDeadline.signal]));
  } finally {
    clearTimeout(uploadTimer);
  }
  return preparePalmImage(read, mime);
}

export function palmFailureResponse(e: unknown): Response {
  if (e instanceof PalmUploadRejected) return fail(e.status, e.code);
  if (e instanceof PalmImageError) return fail(...IMAGE_FAILURE[e.failure]);
  if (e instanceof PalmProviderError) return fail(...PROVIDER_FAILURE[e.failure]);
  return fail(503, 'UNAVAILABLE');
}

export function palmProviderFailureCode(e: unknown): PalmErrorCode | null {
  return e instanceof PalmProviderError ? PROVIDER_FAILURE[e.failure][1] : null;
}

export { json as palmJson, fail as palmFail };

export async function handlePalmAnalyze(req: Request, deps: PalmAnalyzeDeps): Promise<Response> {
  const started = Date.now();
  const config = readPalmExtractionConfig(deps.env);
  if (!config.enabled || !config.secret || !config.apiKey) return fail(503, 'UNAVAILABLE');
  // 인증은 body를 읽기 전에 확인한다
  if (!isOperatorSecretValid(req.headers.get(PALM_SECRET_HEADER), config.secret)) return fail(401, 'ACCESS_DENIED');

  const gate = deps.gate.acquire(req.headers.get(PALM_REQUEST_ID_HEADER));
  if (!gate.ok) return fail(429, 'RATE_LIMITED', gate.retryAfterSeconds);

  let ledger: { finalize: (status: 'completed' | 'failed' | 'uncertain', code: string | null) => Promise<void> } | null = null;
  try {
    const remaining = () => deps.requestTimeoutMs - (Date.now() - started);
    const prepared = await readAndPreparePalmUpload(req, remaining);

    // 공개 기능의 공유 저장소가 구성돼 있으면 운영자 호출도 provider 전역 일/동시 상한에 포함한다
    if (deps.globalBudget) {
      const b = deps.globalBudget;
      const requestId = randomUUID();
      const reserved = await palmWithin(b.store.reserve({
        kind: 'operator', sessionKey: 'operator-path-ledger', requestId,
        payloadFingerprint: `operator:${requestId}`, ipKey: 'operator', limits: b.limits,
      }), PALM_DB_CALL_TIMEOUT_MS);
      if (!reserved.ok) return fail(503, 'UNAVAILABLE');
      const outcome = reserved.value;
      if (outcome.outcome !== 'reserved') return fail(429, 'RATE_LIMITED', 'retryAfterSeconds' in outcome ? outcome.retryAfterSeconds : 60);
      // finalize는 상한 안에서 한 번만 (확인 못 하면 lease 만료로 uncertain — 환불·재호출 없음)
      ledger = { finalize: async (status, code) => { await palmWithin(b.store.finalize('operator-path-ledger', requestId, status, code), PALM_DB_CALL_TIMEOUT_MS); } };
    }

    const providerTimeoutMs = Math.min(deps.providerTimeoutMs, remaining());
    if (providerTimeoutMs <= 0) {
      await ledger?.finalize('failed', 'PROVIDER_TIMEOUT').catch(() => undefined);
      return fail(504, 'PROVIDER_TIMEOUT');
    }
    try {
      const bundle = await extractPalmObservation(prepared, deps.createProvider(config.apiKey), {
        signal: req.signal, metadata: deps.metadata, providerTimeoutMs,
      });
      await ledger?.finalize('completed', null).catch(() => undefined);
      // unusable·partial도 유효한 관찰이므로 200이다
      return json(200, { ok: true, bundle });
    } catch (e) {
      const code = palmProviderFailureCode(e);
      await ledger?.finalize(code === 'PROVIDER_TIMEOUT' ? 'uncertain' : 'failed', code ?? 'UNAVAILABLE').catch(() => undefined);
      throw e;
    }
  } catch (e) {
    return palmFailureResponse(e);
  } finally {
    gate.release();
  }
}
