import { isAnalysisSnapshot, type AnalysisOutput, type AnalysisSnapshot } from './analysis';

interface SavedAnalysisMeta {
  nickname: string;
  birthdate: string;
  mbti: string;
  bloodtype: string;
  keywords: string[];
  tarotName: string;
  zodiacSign: string;
}

// localStorage에 실제로 기록되는 형태. 구버전 항목은 resultData가 AnalysisOutput이다.
interface StoredAnalysis extends SavedAnalysisMeta {
  id: string;
  createdAt: string;   // ISO string — 저장 시각
  resultData: AnalysisSnapshot | AnalysisOutput;
}

// 읽을 때 v2(스냅샷 전체 보관)와 legacy(충돌·키워드 강도 없음)를 명시적으로 구분한다.
// legacy 항목은 현재 규칙으로 재계산하지 않는다 — 저장 당시 결과가 아니게 되므로.
export type SavedAnalysis = SavedAnalysisMeta & { id: string; createdAt: string } & (
  | { kind: 'v2'; resultData: AnalysisSnapshot }
  | { kind: 'legacy'; resultData: AnalysisOutput }
);

const STORAGE_KEY = 'destiny_ai_v1';
const MAX_SAVED = 10;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readStored(): StoredAnalysis[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAnalysis[]) : [];
  } catch {
    return [];
  }
}

function toSavedAnalysis(item: StoredAnalysis): SavedAnalysis {
  const { resultData, ...rest } = item;
  return isAnalysisSnapshot(resultData)
    ? { ...rest, kind: 'v2', resultData }
    : { ...rest, kind: 'legacy', resultData };
}

export function getSavedAnalyses(): SavedAnalysis[] {
  return readStored().map(toSavedAnalysis);
}

export function saveAnalysis(
  meta: SavedAnalysisMeta,
  resultData: AnalysisSnapshot | AnalysisOutput,
): SavedAnalysis {
  const list = readStored();
  // 스냅샷은 분석 ID를 그대로 저장 ID로 쓴다 — 같은 분석을 다시 저장해도 중복되지 않는다.
  if (isAnalysisSnapshot(resultData)) {
    const existing = list.find((a) => a.id === resultData.analysisId);
    if (existing) return toSavedAnalysis(existing);
  }
  const item: StoredAnalysis = {
    ...meta,
    id: isAnalysisSnapshot(resultData)
      ? resultData.analysisId
      : Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    resultData,
  };
  const next = [item, ...list].slice(0, MAX_SAVED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return toSavedAnalysis(item);
}

export function deleteAnalysis(id: string): void {
  if (!isBrowser()) return;
  const next = readStored().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function formatSavedDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
