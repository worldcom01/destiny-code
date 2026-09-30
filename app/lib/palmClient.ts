import { parsePalmObservationBundle, type PalmObservationBundle } from './palmObservation';
import { PALM_PROCESSING_NOTICE_VERSION } from './palmSupplement';

// ── Palm Phase 1C: 브라우저 → 서버 호출 (same-origin만) ─────────────────────────
// 서버 secret은 여기 없다. 세션은 HttpOnly cookie(스크립트가 읽을 수 없음) + 응답의 CSRF token.
// 자동 재시도 없음. 사용자가 명시적으로 분석/재시도를 누를 때만 요청한다.

export type PalmSessionState = { enabled: false } | { enabled: true; csrfToken: string };

let sessionPromise: Promise<PalmSessionState> | null = null;

export function ensurePalmSession(force = false): Promise<PalmSessionState> {
  if (!sessionPromise || force) {
    sessionPromise = fetch('/api/palm/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => {
        const b = (await r.json()) as { enabled?: unknown; csrfToken?: unknown };
        return b.enabled === true && typeof b.csrfToken === 'string' ? { enabled: true as const, csrfToken: b.csrfToken } : { enabled: false as const };
      })
      .catch(() => ({ enabled: false as const }));
    const p = sessionPromise;
    // 실패/비활성 결과는 다음 시도 때 다시 확인한다
    p.then((s) => { if (!s.enabled && sessionPromise === p) sessionPromise = null; });
  }
  return sessionPromise;
}

export type PalmAnalyzeOutcome =
  | { ok: true; bundle: PalmObservationBundle }
  | { ok: false; code: string; retryAfterSeconds?: number };

export async function requestPalmObservation(file: Blob, csrfToken: string, requestId: string, signal: AbortSignal): Promise<PalmAnalyzeOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/palm/analyze', {
      method: 'POST',
      body: file,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: {
        'content-type': file.type,
        'x-palm-csrf': csrfToken,
        'x-palm-request-id': requestId,
        'x-palm-notice': PALM_PROCESSING_NOTICE_VERSION,
      },
    });
  } catch {
    return { ok: false, code: signal.aborted ? 'ABORTED' : 'NETWORK' };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, code: 'NETWORK' };
  }
  const b = body as { ok?: unknown; bundle?: unknown; error?: { code?: unknown; retryAfterSeconds?: unknown } };
  if (res.ok && b.ok === true) {
    try {
      return { ok: true, bundle: parsePalmObservationBundle(b.bundle) }; // 서버 응답도 계약으로 다시 검증
    } catch {
      return { ok: false, code: 'INVALID_PROVIDER_RESPONSE' };
    }
  }
  const code = typeof b.error?.code === 'string' ? b.error.code : 'UNAVAILABLE';
  const retry = typeof b.error?.retryAfterSeconds === 'number' ? b.error.retryAfterSeconds : undefined;
  return { ok: false, code, retryAfterSeconds: retry };
}
