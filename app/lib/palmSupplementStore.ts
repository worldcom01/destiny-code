import { getSavedAnalyses, type SavedAnalysis } from './storageEngine';
import { parsePalmBaseRef, parsePalmSupplement, sameBaseRef, type PalmBaseRef, type PalmSupplement } from './palmSupplement';

// ── Palm Phase 1C: 보조 기록 전용 localStorage (destiny_palm_supplements_v1) ──
// 기본 저장소(destiny_ai_v1)와 분리한다. 사진·미리보기·해시는 저장하지 않는다 — 검증된 관찰과
// 파생 해석/비교만 저장한다. 저장된 결과가 있는 base에만 기록하고, 읽을 때 orphan을 정리한다.
// 두 key를 원자적으로 저장하는 척하지 않는다: 호출부는 base 저장 후 보조 저장을 별도로 확인한다.

export const PALM_SUPPLEMENT_STORAGE_KEY = 'destiny_palm_supplements_v1';
const MAX_SUPPLEMENTS = 10;

// 저장 목록 항목의 연결 키. snapshot은 analysisId(과거 savedId≠analysisId 항목 포함), legacy는 savedId.
export function savedBaseRef(saved: SavedAnalysis): PalmBaseRef {
  return saved.kind === 'v2'
    ? { kind: 'snapshot', id: saved.resultData.analysisId }
    : { kind: 'legacy', id: saved.id };
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readRaw(): unknown[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(PALM_SUPPLEMENT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: unknown[]): boolean {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(PALM_SUPPLEMENT_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false; // 용량 초과 등 — 호출부가 보조 저장 실패로 안내한다
  }
}

// 모르는 버전의 기록도 연결 키만 읽을 수 있으면 보존한다 (base는 표시, 보조 결과만 읽기 제한).
function refOf(entry: unknown): PalmBaseRef | null {
  try {
    return parsePalmBaseRef((entry as { baseRef?: unknown }).baseRef);
  } catch {
    return null;
  }
}

export type PalmSupplementRead =
  | { status: 'none' }
  | { status: 'ok'; supplement: PalmSupplement }
  | { status: 'unsupported' };

export function readPalmSupplement(baseRef: PalmBaseRef | null): PalmSupplementRead {
  if (!baseRef) return { status: 'none' };
  const entry = readRaw().find((e) => sameBaseRef(refOf(e), baseRef));
  if (entry === undefined) return { status: 'none' };
  try {
    const supplement = parsePalmSupplement(entry);
    // 기록 내부 baseRef가 요청한 결과와 다르면 절대 반환하지 않는다
    return sameBaseRef(supplement.baseRef, baseRef) ? { status: 'ok', supplement } : { status: 'unsupported' };
  } catch {
    return { status: 'unsupported' };
  }
}

export type PalmSupplementSaveResult = { ok: true } | { ok: false; reason: 'base-not-saved' | 'storage-failed' | 'invalid' };

// 저장된 base가 있을 때만 쓴다. 같은 base의 이전 기록은 새 성공본으로 교체한다 (명시적 저장 때만 호출).
export function savePalmSupplement(supplement: PalmSupplement): PalmSupplementSaveResult {
  let valid: PalmSupplement;
  try {
    valid = parsePalmSupplement(supplement);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const bases = getSavedAnalyses().map(savedBaseRef);
  if (!bases.some((b) => sameBaseRef(b, valid.baseRef))) return { ok: false, reason: 'base-not-saved' };
  const others = readRaw().filter((e) => {
    const ref = refOf(e);
    return ref !== null && !sameBaseRef(ref, valid.baseRef) && bases.some((b) => sameBaseRef(b, ref));
  });
  return writeRaw([valid, ...others].slice(0, MAX_SUPPLEMENTS)) ? { ok: true } : { ok: false, reason: 'storage-failed' };
}

export function deletePalmSupplement(baseRef: PalmBaseRef): void {
  const entries = readRaw();
  const next = entries.filter((e) => !sameBaseRef(refOf(e), baseRef));
  if (next.length !== entries.length) writeRaw(next);
}

// 저장 목록에 없는 base(삭제·10개 제한 eviction)의 기록과 읽을 수 없는 항목을 제거한다.
export function prunePalmSupplements(): void {
  const entries = readRaw();
  if (entries.length === 0) return;
  const bases = getSavedAnalyses().map(savedBaseRef);
  const next = entries
    .filter((e) => {
      const ref = refOf(e);
      return ref !== null && bases.some((b) => sameBaseRef(b, ref));
    })
    .slice(0, MAX_SUPPLEMENTS);
  if (next.length !== entries.length) writeRaw(next);
}

// 기본 결과 저장 직후 호출: 저장 전 손바닥 결과가 "지금 이 결과"에 속할 때만 저장한다.
// 다른 결과(A의 pending이 B 저장 때)에 붙는 일은 없다.
export function savePendingPalmFor(
  currentBaseRef: PalmBaseRef | null,
  pending: PalmSupplement | null,
): PalmSupplementSaveResult | { ok: false; reason: 'none' | 'other-result' } {
  if (!pending) return { ok: false, reason: 'none' };
  if (!sameBaseRef(pending.baseRef, currentBaseRef)) return { ok: false, reason: 'other-result' };
  return savePalmSupplement(pending);
}

export type PalmBaseThenPalmResult =
  | { base: 'failed' }
  | { base: 'saved'; palm: PalmSupplementSaveResult | { ok: false; reason: 'none' | 'other-result' } };

// 기본 결과를 먼저 저장하고(예외를 잡는다), 성공했을 때만 이 결과의 Palm 보조 기록을 저장한다.
// 기본 저장이 실패하면 보조 기록을 쓰지 않는다 — orphan 없음. 받은 관찰은 호출부 메모리에 남아
// 사용자가 다시 저장할 수 있고, provider를 다시 호출하지 않는다.
export function saveBaseThenPalm(
  saveBase: () => unknown,
  currentBaseRef: PalmBaseRef | null,
  pending: PalmSupplement | null,
): PalmBaseThenPalmResult {
  try {
    saveBase();
  } catch {
    return { base: 'failed' };
  }
  return { base: 'saved', palm: savePendingPalmFor(currentBaseRef, pending) };
}
