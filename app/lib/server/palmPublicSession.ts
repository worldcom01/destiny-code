import 'server-only';
import {
  checkPalmOrigin,
  createPalmSession,
  isPalmCsrfValid,
  palmCsrfToken,
  palmIpKey,
  palmSessionCookieHeader,
  palmSessionKey,
  PALM_CSRF_HEADER,
  PALM_SESSION_COOKIE,
  readCookie,
  readPalmPublicConfig,
  trustedClientIp,
  verifyPalmSessionCookie,
} from './palmPublicAccess';
import { palmWithin, PALM_DB_CALL_TIMEOUT_MS, type PalmEventName, type PalmPublicStore } from './palmPublicGate';
import { PALM_PROCESSING_NOTICE_VERSION } from '../palmSupplement';
import { PalmImageError, readBoundedBody } from './palmImage';

// ── Palm Phase 1C: POST /api/palm/session, POST /api/palm/events ──────────────
// session: 정확한 Origin + same-origin만. 유효한 cookie가 있으면 재사용(발급 한도 소모 없음),
//          없으면 IP별 시간당 한도 안에서 새로 발급. 응답은 CSRF token과 enabled 여부뿐.
// events:  허용된 클라이언트 이벤트(표시·시작·재시도)만. 성공/실패는 서버가 기록한다.
//          image/관찰/trait/baseId/Destiny Code/닉네임/IP/파일명 등은 받을 필드 자체가 없다.

export type PalmSessionDeps = {
  env: Record<string, string | undefined>;
  createStore: (config: { supabaseUrl: string; supabaseServiceKey: string }) => Promise<PalmPublicStore>;
  now?: () => number;
  eventReadTimeoutMs?: number; // 이벤트 본문 읽기 상한 (기본 2초)
};

const NO_STORE = { 'Cache-Control': 'no-store' };

function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export async function handlePalmSession(req: Request, deps: PalmSessionDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const config = readPalmPublicConfig(deps.env);
  if (!config.enabled) return reply(200, { enabled: false });
  if (checkPalmOrigin(req, config.origin) !== 'ok') return reply(403, { enabled: false, error: 'ACCESS_DENIED' });

  const existing = verifyPalmSessionCookie(readCookie(req.headers.get('cookie'), PALM_SESSION_COOKIE), config.sessionSecret, now());
  if (existing) {
    return reply(200, { enabled: true, csrfToken: palmCsrfToken(config.sessionSecret, existing.sessionId), noticeVersion: PALM_PROCESSING_NOTICE_VERSION });
  }
  const ip = trustedClientIp(req, config.trustedIpHeader);
  if (!ip) return reply(503, { enabled: false, error: 'UNAVAILABLE' });
  let issued;
  try {
    const store = await deps.createStore(config);
    const r = await palmWithin(store.issueSession(palmIpKey(config.sessionSecret, ip, now()), config.limits.sessionIssuePerIpHour), PALM_DB_CALL_TIMEOUT_MS);
    if (!r.ok) return reply(503, { enabled: false, error: 'UNAVAILABLE' });
    issued = r.value;
  } catch {
    return reply(503, { enabled: false, error: 'UNAVAILABLE' });
  }
  if (issued.outcome === 'rate-limited') {
    return reply(429, { enabled: true, error: 'RATE_LIMITED', retryAfterSeconds: issued.retryAfterSeconds }, { 'Retry-After': String(issued.retryAfterSeconds) });
  }
  const { session, cookieValue } = createPalmSession(config.sessionSecret, now());
  return reply(
    200,
    { enabled: true, csrfToken: palmCsrfToken(config.sessionSecret, session.sessionId), noticeVersion: PALM_PROCESSING_NOTICE_VERSION },
    { 'Set-Cookie': palmSessionCookieHeader(cookieValue, session.expiresAt - Math.floor(now() / 1000)) },
  );
}

// 클라이언트가 보낼 수 있는 이벤트. palm_success/unusable/error는 서버 analyze 경로가 기록한다 (중복 집계 방지).
export const PALM_CLIENT_EVENTS: readonly PalmEventName[] = ['palm_prompt_viewed', 'palm_started', 'palm_retry'];
const MAX_EVENT_BODY = 512;           // 실제 byte 상한 — 스트리밍 중 초과하면 즉시 취소
const EVENT_READ_TIMEOUT_MS = 2_000;

export async function handlePalmEvent(req: Request, deps: PalmSessionDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const config = readPalmPublicConfig(deps.env);
  if (!config.enabled) return new Response(null, { status: 204, headers: NO_STORE });
  if (checkPalmOrigin(req, config.origin) !== 'ok') return reply(403, { ok: false });
  const session = verifyPalmSessionCookie(readCookie(req.headers.get('cookie'), PALM_SESSION_COOKIE), config.sessionSecret, now());
  if (!session || !isPalmCsrfValid(req.headers.get(PALM_CSRF_HEADER), config.sessionSecret, session.sessionId)) return reply(403, { ok: false });
  if ((req.headers.get('content-type') ?? '').split(';')[0].trim() !== 'application/json') return reply(415, { ok: false });

  // 기존 hardened bounded reader 재사용: 누적 byte로 상한을 강제하고, 초과·deadline·요청 취소 시 reader를 취소한다.
  // 본문은 로그에 남기지 않는다.
  let body: unknown;
  try {
    const bytes = await readBoundedBody(req.body, MAX_EVENT_BODY,
      AbortSignal.any([req.signal, AbortSignal.timeout(deps.eventReadTimeoutMs ?? EVENT_READ_TIMEOUT_MS)]));
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (e) {
    if (e instanceof PalmImageError && e.failure === 'too-large') return reply(413, { ok: false });
    return reply(400, { ok: false }); // 빈 본문·끊긴 stream·지연·취소·잘못된 UTF-8/JSON
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return reply(400, { ok: false });
  const b = body as Record<string, unknown>;
  const keys = Object.keys(b).sort().join(',');
  if (keys !== 'event,eventId' || typeof b.eventId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(b.eventId)
    || !PALM_CLIENT_EVENTS.includes(b.event as PalmEventName)) return reply(400, { ok: false });

  try {
    const store = await deps.createStore(config);
    const r = await palmWithin(store.recordEvent(
      palmSessionKey(config.sessionSecret, session.sessionId),
      { eventId: b.eventId, event: b.event as PalmEventName, supplementVersion: 1, durationBucket: null, errorCode: null },
      config.limits.eventsPerSessionDaily,
    ), PALM_DB_CALL_TIMEOUT_MS);
    if (!r.ok) return reply(503, { ok: false });
    return reply(r.value === 'rate-limited' ? 429 : 202, { ok: r.value !== 'rate-limited' });
  } catch {
    return reply(503, { ok: false }); // UI는 analytics 실패를 무시한다
  }
}
