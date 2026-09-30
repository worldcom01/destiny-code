import 'server-only';
import type { PalmPublicLimits } from './palmPublicAccess';

// ── Palm Phase 1C: 공유 저장소 기반 비용 통제 gate ─────────────────────────────
// 여러 server instance가 같은 Postgres(Supabase) RPC를 거치므로 한도·중복·동시성이 전역이다
// (supabase/palm-public.sql — advisory lock으로 예약을 직렬화). 이 파일은 RPC 호출과
// 응답의 엄격한 해석만 담당한다. 저장소 오류·예상 밖 응답은 PalmGateUnavailable → 호출부 fail closed.
// exactly-once provider 처리나 결과 복구를 보장하지 않는다. 예약된 budget은 환불하지 않는다.

export class PalmGateUnavailable extends Error {
  constructor() {
    super('palm gate unavailable');
    this.name = 'PalmGateUnavailable';
  }
}

export type PalmLedgerStatus = 'reserved' | 'provider-started' | 'completed' | 'failed' | 'uncertain';

export type PalmReserveOutcome =
  | { outcome: 'reserved' }
  | { outcome: 'duplicate-request'; status: PalmLedgerStatus }
  | { outcome: 'request-conflict' }
  | { outcome: 'duplicate-image'; retryAfterSeconds: number }
  | { outcome: 'rate-limited'; retryAfterSeconds: number };

export type PalmReserveInput = {
  kind: 'public' | 'operator';
  sessionKey: string;
  requestId: string;
  payloadFingerprint: string;
  ipKey: string;
  limits: PalmPublicLimits;
};

export type PalmEventName = 'palm_prompt_viewed' | 'palm_started' | 'palm_success' | 'palm_unusable' | 'palm_error' | 'palm_retry';
export type PalmDurationBucket = 'lt5s' | '5to15s' | '15to30s' | 'gt30s';
export type PalmEventRecord = {
  eventId: string;
  event: PalmEventName;
  supplementVersion: number | null;
  durationBucket: PalmDurationBucket | null;
  errorCode: string | null;
};

export interface PalmPublicStore {
  issueSession(ipKey: string, limitPerHour: number): Promise<{ outcome: 'issued' } | { outcome: 'rate-limited'; retryAfterSeconds: number }>;
  reserve(input: PalmReserveInput): Promise<PalmReserveOutcome>;
  markStarted(sessionKey: string, requestId: string): Promise<boolean>;
  finalize(sessionKey: string, requestId: string, status: 'completed' | 'failed' | 'uncertain', errorCode: string | null): Promise<void>;
  recordEvent(sessionKey: string, event: PalmEventRecord, dailyLimit: number): Promise<'recorded' | 'duplicate' | 'rate-limited'>;
}

// 최소 RPC 호출 계약 — Supabase client와 테스트용 Postgres(PGlite) 모두 이 모양으로 연결한다.
// signal은 호출 시간 한도가 지나면 abort된다 (Supabase는 HTTP 요청 자체를 취소).
export type PalmRpc = (fn: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;

// 모든 공유 DB 호출의 상한 (Codex I-2). 초과하면 PalmGateUnavailable — 무기한 대기 없음.
export const PALM_DB_CALL_TIMEOUT_MS = 2_500;

// promise를 ms 안에 끝나면 값, 아니면 'timeout'. 원래 작업을 취소하지는 않는다(호출부가 signal로 취소).
export async function palmWithin<T>(promise: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), Math.max(0, ms)); });
  try {
    const r = await Promise.race([promise.then((value) => ({ value })), timeout]);
    return r === 'timeout' ? { ok: false, timedOut: true } : { ok: true, value: r.value };
  } catch {
    return { ok: false, timedOut: false };
  } finally {
    clearTimeout(timer);
  }
}

const LEDGER_STATUSES: readonly PalmLedgerStatus[] = ['reserved', 'provider-started', 'completed', 'failed', 'uncertain'];

function retryAfter(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 172_800) throw new PalmGateUnavailable();
  return n;
}

function asObject(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new PalmGateUnavailable();
  return v as Record<string, unknown>;
}

export function parseReserveOutcome(raw: unknown): PalmReserveOutcome {
  const r = asObject(raw);
  switch (r.outcome) {
    case 'reserved': return { outcome: 'reserved' };
    case 'request-conflict': return { outcome: 'request-conflict' };
    case 'duplicate-request':
      if (!LEDGER_STATUSES.includes(r.status as PalmLedgerStatus)) throw new PalmGateUnavailable();
      return { outcome: 'duplicate-request', status: r.status as PalmLedgerStatus };
    case 'duplicate-image': return { outcome: 'duplicate-image', retryAfterSeconds: retryAfter(r.retry_after) };
    case 'rate-limited': return { outcome: 'rate-limited', retryAfterSeconds: retryAfter(r.retry_after) };
    default: throw new PalmGateUnavailable();
  }
}

export function createPalmPublicStore(rpc: PalmRpc, options: { callTimeoutMs?: number } = {}): PalmPublicStore {
  const limitMs = options.callTimeoutMs ?? PALM_DB_CALL_TIMEOUT_MS;
  const call = async (_rpc: PalmRpc, fn: string, args: Record<string, unknown>): Promise<unknown> => {
    const controller = new AbortController();
    const r = await palmWithin(_rpc(fn, args, controller.signal), limitMs);
    if (!r.ok) {
      controller.abort();
      throw new PalmGateUnavailable(); // timeout·원문 DB 오류 모두 정규화 — 원문은 전달하지 않는다
    }
    return r.value;
  };
  return {
    async issueSession(ipKey, limitPerHour) {
      const r = asObject(await call(rpc, 'palm_issue_session', { p_ip_key: ipKey, p_limit_per_hour: limitPerHour }));
      if (r.outcome === 'issued') return { outcome: 'issued' };
      if (r.outcome === 'rate-limited') return { outcome: 'rate-limited', retryAfterSeconds: retryAfter(r.retry_after) };
      throw new PalmGateUnavailable();
    },
    async reserve(input) {
      return parseReserveOutcome(await call(rpc, 'palm_reserve', {
        p_kind: input.kind,
        p_session_key: input.sessionKey,
        p_request_id: input.requestId,
        p_payload_fp: input.payloadFingerprint,
        p_ip_key: input.ipKey,
        p_limits: {
          sessionConcurrent: input.limits.sessionConcurrent,
          sessionIntervalSeconds: input.limits.sessionIntervalSeconds,
          sessionDaily: input.limits.sessionDaily,
          ipDaily: input.limits.ipDaily,
          globalConcurrent: input.limits.globalConcurrent,
          globalDaily: input.limits.globalDaily,
        },
      }));
    },
    async markStarted(sessionKey, requestId) {
      const r = await call(rpc, 'palm_mark_started', { p_session_key: sessionKey, p_request_id: requestId });
      if (typeof r !== 'boolean') throw new PalmGateUnavailable();
      return r;
    },
    async finalize(sessionKey, requestId, status, errorCode) {
      await call(rpc, 'palm_finalize', { p_session_key: sessionKey, p_request_id: requestId, p_status: status, p_error_code: errorCode });
    },
    async recordEvent(sessionKey, e, dailyLimit) {
      const r = asObject(await call(rpc, 'palm_record_event', {
        p_session_key: sessionKey,
        p_event_id: e.eventId,
        p_event: e.event,
        p_supplement_version: e.supplementVersion,
        p_duration_bucket: e.durationBucket,
        p_error_code: e.errorCode,
        p_daily_limit: dailyLimit,
      }));
      if (r.outcome === 'recorded' || r.outcome === 'duplicate' || r.outcome === 'rate-limited') return r.outcome;
      throw new PalmGateUnavailable();
    },
  };
}

// Supabase(service role) 연결 — 서버에서만. anon key는 이 RPC를 실행할 수 없다 (SQL에서 REVOKE).
export async function createSupabasePalmRpc(url: string, serviceKey: string): Promise<PalmRpc> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return async (fn, args, signal) => {
    const query = client.rpc(fn, args);
    const { data, error } = await (signal ? query.abortSignal(signal) : query);
    if (error) throw new PalmGateUnavailable();
    return data;
  };
}

export function durationBucket(ms: number): PalmDurationBucket {
  if (ms < 5_000) return 'lt5s';
  if (ms < 15_000) return '5to15s';
  if (ms < 30_000) return '15to30s';
  return 'gt30s';
}
