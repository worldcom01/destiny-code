import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PALM_PROCESSING_NOTICE_VERSION } from '../palmSupplement';

// ── Palm Phase 1C: 공개 브라우저 접근 (익명 서명 세션 + same-origin + CSRF) ──────
// (docs/ai/CODEX_REVIEW.md "Palm Phase 1C" §6, DECISIONS AD-009)
// 운영자 PALM_EXTRACTION_SECRET은 여기서 쓰지 않고 브라우저에 절대 전달하지 않는다.
// 세션은 계정 소유권 인증이 아니라 익명 비용 통제 단위다. 서명 키는 별도 server-only
// PALM_SESSION_SECRET. 필요한 설정이 하나라도 없으면 공개 기능은 꺼진다 (fail closed).

export const PALM_SESSION_COOKIE = '__Host-palm_session';
export const PALM_CSRF_HEADER = 'x-palm-csrf';
export const PALM_PUBLIC_REQUEST_ID_HEADER = 'x-palm-request-id';
export const PALM_NOTICE_HEADER = 'x-palm-notice';
export const PALM_SESSION_TTL_SECONDS = 24 * 60 * 60;

export type PalmPublicLimits = {
  sessionConcurrent: number;
  sessionIntervalSeconds: number;
  sessionDaily: number;
  ipDaily: number;
  globalConcurrent: number;
  globalDaily: number;
  sessionIssuePerIpHour: number;
  eventsPerSessionDaily: number;
};

// 운영 상한 초기값 (통계적 근거가 아니라 보수적 운영값). 서버 env로만 조정한다.
export const PALM_DEFAULT_LIMITS: PalmPublicLimits = {
  sessionConcurrent: 1,
  sessionIntervalSeconds: 30,
  sessionDaily: 3,
  ipDaily: 10,
  globalConcurrent: 2,
  globalDaily: 100,
  sessionIssuePerIpHour: 10,
  eventsPerSessionDaily: 50,
};

const LIMIT_ENV: Record<keyof PalmPublicLimits, string> = {
  sessionConcurrent: 'PALM_LIMIT_SESSION_CONCURRENT',
  sessionIntervalSeconds: 'PALM_LIMIT_SESSION_INTERVAL_SECONDS',
  sessionDaily: 'PALM_LIMIT_SESSION_DAILY',
  ipDaily: 'PALM_LIMIT_IP_DAILY',
  globalConcurrent: 'PALM_LIMIT_GLOBAL_CONCURRENT',
  globalDaily: 'PALM_LIMIT_GLOBAL_DAILY',
  sessionIssuePerIpHour: 'PALM_LIMIT_SESSION_ISSUE_PER_IP_HOUR',
  eventsPerSessionDaily: 'PALM_LIMIT_EVENTS_PER_SESSION_DAILY',
};

export type PalmPublicConfig =
  | { enabled: false }
  | {
      enabled: true;
      apiKey: string;
      sessionSecret: string;
      origin: string;
      trustedIpHeader: string;
      supabaseUrl: string;
      supabaseServiceKey: string;
      limits: PalmPublicLimits;
    };

export function readPalmPublicConfig(env: Record<string, string | undefined>): PalmPublicConfig {
  // PALM_EXTRACTION_ENABLED는 provider 전체 kill switch, PALM_PUBLIC_ENABLED는 공개 경로 switch
  if (env.PALM_EXTRACTION_ENABLED !== 'true' || env.PALM_PUBLIC_ENABLED !== 'true') return { enabled: false };
  const apiKey = env.OPENAI_API_KEY ?? '';
  const sessionSecret = env.PALM_SESSION_SECRET ?? '';
  const origin = env.PALM_PUBLIC_ORIGIN ?? '';
  const trustedIpHeader = (env.PALM_TRUSTED_IP_HEADER ?? '').trim().toLowerCase();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!apiKey || sessionSecret.length < 32 || !isExactOrigin(origin) || !/^[a-z0-9-]{3,64}$/.test(trustedIpHeader)
    || !supabaseUrl || !supabaseServiceKey) return { enabled: false };
  // 운영자 secret과 같은 값을 세션 서명 키로 재사용하지 않는다
  if (env.PALM_EXTRACTION_SECRET && env.PALM_EXTRACTION_SECRET === sessionSecret) return { enabled: false };
  const limits = { ...PALM_DEFAULT_LIMITS };
  for (const key of Object.keys(LIMIT_ENV) as (keyof PalmPublicLimits)[]) {
    const raw = env[LIMIT_ENV[key]];
    if (raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 100_000) return { enabled: false };
    limits[key] = n;
  }
  return { enabled: true, apiKey, sessionSecret, origin, trustedIpHeader, supabaseUrl, supabaseServiceKey, limits };
}

// 정확한 origin만 허용: scheme://host[:port], path/query/wildcard 없음, https (localhost 개발만 http)
function isExactOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.origin !== origin || !/^[a-z0-9.-]+$/.test(u.hostname)) return false; // wildcard·특수문자 host 거부
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

const b64url = (buf: Buffer) => buf.toString('base64url');
const hmac = (secret: string, ...parts: (string | Uint8Array)[]) => {
  const h = createHmac('sha256', secret);
  for (const p of parts) h.update(p);
  return h.digest();
};

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type PalmSession = { sessionId: string; expiresAt: number };

export function createPalmSession(secret: string, nowMs: number): { session: PalmSession; cookieValue: string } {
  const sessionId = b64url(randomBytes(32));
  const expiresAt = Math.floor(nowMs / 1000) + PALM_SESSION_TTL_SECONDS;
  const sig = b64url(hmac(secret, `palm-session-v1|${sessionId}|${expiresAt}`));
  return { session: { sessionId, expiresAt }, cookieValue: `${sessionId}.${expiresAt}.${sig}` };
}

export function verifyPalmSessionCookie(value: string | undefined, secret: string, nowMs: number): PalmSession | null {
  if (!value || value.length > 200) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, exp, sig] = parts;
  if (!/^[A-Za-z0-9_-]{43}$/.test(sessionId) || !/^\d{1,12}$/.test(exp)) return null;
  const expected = b64url(hmac(secret, `palm-session-v1|${sessionId}|${exp}`));
  if (!safeEqual(sig, expected)) return null;
  const expiresAt = Number(exp);
  if (expiresAt * 1000 <= nowMs || expiresAt * 1000 > nowMs + PALM_SESSION_TTL_SECONDS * 1000 + 60_000) return null;
  return { sessionId, expiresAt };
}

export function palmSessionCookieHeader(cookieValue: string, maxAgeSeconds: number): string {
  // __Host-: Secure, Path=/, Domain 없음. HttpOnly로 스크립트 접근 차단, SameSite=Strict로 cross-site 전송 차단
  return `${PALM_SESSION_COOKIE}=${cookieValue}; Path=/; Max-Age=${Math.max(0, maxAgeSeconds)}; HttpOnly; Secure; SameSite=Strict`;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

// session에 묶인 CSRF token (별도 저장 없음)
export function palmCsrfToken(secret: string, sessionId: string): string {
  return b64url(hmac(secret, `palm-csrf-v1|${sessionId}`));
}

export function isPalmCsrfValid(provided: string | null, secret: string, sessionId: string): boolean {
  return !!provided && safeEqual(provided, palmCsrfToken(secret, sessionId));
}

// DB에는 원래 session ID·IP를 넣지 않고 서버 HMAC만 넣는다. IP key는 UTC 일마다 바뀐다.
export function palmSessionKey(secret: string, sessionId: string): string {
  return b64url(hmac(secret, `palm-ledger-v1|${sessionId}`));
}

export function palmIpKey(secret: string, ip: string, nowMs: number): string {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return b64url(hmac(secret, `palm-ip-v1|${day}|${ip}`));
}

// 준비된 이미지 bytes의 session-bound fingerprint (cross-user 조회 키가 아님, 원본 SHA 아님)
export function palmImageFingerprint(secret: string, sessionId: string, preparedBytes: Uint8Array): string {
  return b64url(hmac(secret, `palm-img-v1|${sessionId}|`, preparedBytes));
}

// 배포 proxy가 설정하는 단일 IP 헤더만 신뢰한다. 목록(쉼표)이나 형식이 이상하면 거부 (임의 XFF 첫 값 불신).
export function trustedClientIp(req: Request, header: string): string | null {
  const raw = req.headers.get(header);
  if (!raw) return null;
  const ip = raw.trim();
  if (ip.length > 45 || ip.includes(',') || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}

export type PalmOriginCheck = 'ok' | 'bad-origin' | 'cross-site';

// 정확한 Origin 일치 + (있으면) Sec-Fetch-Site same-origin. 인증 수단이 아니라 cross-site 차단 보조.
export function checkPalmOrigin(req: Request, allowedOrigin: string): PalmOriginCheck {
  if (req.headers.get('origin') !== allowedOrigin) return 'bad-origin';
  const site = req.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin') return 'cross-site';
  return 'ok';
}

export function isPalmRequestId(value: string | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

export function isAcceptedPalmNotice(value: string | null): boolean {
  return value === PALM_PROCESSING_NOTICE_VERSION;
}
