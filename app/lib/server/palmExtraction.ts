import 'server-only';
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
  | 'PROVIDER_TIMEOUT' | 'PROVIDER_ERROR' | 'INVALID_PROVIDER_RESPONSE';

export type PalmExtractionResponse =
  | { ok: true; bundle: PalmObservationBundle }
  | { ok: false; error: { code: PalmErrorCode; retryAfterSeconds?: number } };

export type PalmAnalyzeDeps = {
  env: Record<string, string | undefined>;
  createProvider: (apiKey: string) => PalmVisionProvider;
  gate: PalmRequestGate;
  metadata: PalmExtractionMetadata;
  requestTimeoutMs: number;
  providerTimeoutMs: number;
};

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(status: number, body: PalmExtractionResponse, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

function fail(status: number, code: PalmErrorCode, retryAfterSeconds?: number): Response {
  // 로그에는 정규화된 code만 남긴다 (이미지·응답·헤더·secret 없음)
  if (status >= 500) console.warn(`[palm] ${code}`);
  return retryAfterSeconds === undefined
    ? json(status, { ok: false, error: { code } })
    : json(status, { ok: false, error: { code, retryAfterSeconds } }, { 'Retry-After': String(retryAfterSeconds) });
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

export async function handlePalmAnalyze(req: Request, deps: PalmAnalyzeDeps): Promise<Response> {
  const started = Date.now();
  const config = readPalmExtractionConfig(deps.env);
  if (!config.enabled || !config.secret || !config.apiKey) return fail(503, 'UNAVAILABLE');
  // 인증은 body를 읽기 전에 확인한다
  if (!isOperatorSecretValid(req.headers.get(PALM_SECRET_HEADER), config.secret)) return fail(401, 'ACCESS_DENIED');

  const gate = deps.gate.acquire(req.headers.get(PALM_REQUEST_ID_HEADER));
  if (!gate.ok) return fail(429, 'RATE_LIMITED', gate.retryAfterSeconds);

  try {
    const encoding = req.headers.get('content-encoding');
    if (encoding && encoding.trim().toLowerCase() !== 'identity') return fail(415, 'INVALID_IMAGE');
    const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!(PALM_ALLOWED_MIME as readonly string[]).includes(mime)) return fail(415, 'INVALID_IMAGE');
    const declared = Number(req.headers.get('content-length') ?? NaN);
    if (Number.isFinite(declared) && declared > PALM_IMAGE_LIMITS.maxInputBytes) return fail(413, 'IMAGE_TOO_LARGE');

    // 느린 업로드도 전체 deadline에 포함된다. deadline·요청 취소 시 본문 reader를 취소하고,
    // 읽기가 실제로 끝난 뒤에만 다음 단계(또는 finally의 slot 해제)로 진행한다 — race로 먼저 반환하지 않는다.
    const remaining = () => deps.requestTimeoutMs - (Date.now() - started);
    const uploadDeadline = new AbortController();
    const uploadTimer = setTimeout(() => uploadDeadline.abort(), Math.max(0, remaining()));
    let read: Uint8Array;
    try {
      read = await readBoundedBody(req.body, PALM_IMAGE_LIMITS.maxInputBytes, AbortSignal.any([req.signal, uploadDeadline.signal]));
    } finally {
      clearTimeout(uploadTimer);
    }

    const prepared = await preparePalmImage(read, mime);

    const providerTimeoutMs = Math.min(deps.providerTimeoutMs, remaining());
    if (providerTimeoutMs <= 0) return fail(504, 'PROVIDER_TIMEOUT');
    const bundle = await extractPalmObservation(prepared, deps.createProvider(config.apiKey), {
      signal: req.signal, metadata: deps.metadata, providerTimeoutMs,
    });
    // unusable·partial도 유효한 관찰이므로 200이다
    return json(200, { ok: true, bundle });
  } catch (e) {
    if (e instanceof PalmImageError) return fail(...IMAGE_FAILURE[e.failure]);
    if (e instanceof PalmProviderError) return fail(...PROVIDER_FAILURE[e.failure]);
    return fail(503, 'UNAVAILABLE');
  } finally {
    gate.release();
  }
}
