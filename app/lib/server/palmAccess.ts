import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

// ── Palm Phase 1B: 운영자 전용 접근 통제 ────────────────────────────────────
// 일반 사용자 인증이 없으므로 endpoint를 익명 공개하지 않는다.
// PALM_EXTRACTION_ENABLED=true + 별도 비공개 PALM_EXTRACTION_SECRET(관리자 secret·provider key와 분리).
// 요청 gate는 instance별 in-memory다 — cold start/다중 instance에서 전역 보장이 아니다.

export type PalmExtractionConfig = { enabled: boolean; secret: string; apiKey: string };

export function readPalmExtractionConfig(env: Record<string, string | undefined>): PalmExtractionConfig {
  return {
    enabled: env.PALM_EXTRACTION_ENABLED === 'true',
    secret: env.PALM_EXTRACTION_SECRET ?? '',
    apiKey: env.OPENAI_API_KEY ?? '',
  };
}

export const PALM_SECRET_HEADER = 'x-palm-extraction-secret';
export const PALM_REQUEST_ID_HEADER = 'x-palm-request-id';

// 길이가 달라도 시간 차이가 드러나지 않도록 hash끼리 비교한다.
export function isOperatorSecretValid(provided: string | null, secret: string): boolean {
  if (!provided || !secret) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

export type PalmGateResult = { ok: true; release: () => void } | { ok: false; retryAfterSeconds: number };

// instance당 동시 1건, 분당 2건, 같은 요청 ID 재사용 10분간 거부. 이미지·응답은 보관하지 않는다.
export class PalmRequestGate {
  private active = 0;
  private starts: number[] = [];
  private seenIds = new Map<string, number>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly limits = { concurrent: 1, perMinute: 2, duplicateTtlMs: 10 * 60_000 },
  ) {}

  acquire(requestId: string | null): PalmGateResult {
    const t = this.now();
    this.starts = this.starts.filter((s) => t - s < 60_000);
    for (const [id, at] of this.seenIds) if (t - at >= this.limits.duplicateTtlMs) this.seenIds.delete(id);

    if (requestId && this.seenIds.has(requestId)) {
      return { ok: false, retryAfterSeconds: Math.ceil((this.limits.duplicateTtlMs - (t - this.seenIds.get(requestId)!)) / 1000) };
    }
    if (this.active >= this.limits.concurrent) return { ok: false, retryAfterSeconds: 30 };
    if (this.starts.length >= this.limits.perMinute) {
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((60_000 - (t - this.starts[0])) / 1000)) };
    }

    this.active++;
    this.starts.push(t);
    if (requestId) this.seenIds.set(requestId, t);
    let released = false;
    return {
      ok: true,
      release: () => {
        if (!released) { released = true; this.active--; }
      },
    };
  }
}
