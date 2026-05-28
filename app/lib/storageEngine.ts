import type { AnalysisOutput } from './analysis';

export interface SavedAnalysis {
  id: string;
  createdAt: string;   // ISO string
  nickname: string;
  birthdate: string;
  mbti: string;
  bloodtype: string;
  keywords: string[];
  tarotName: string;
  zodiacSign: string;
  resultData: AnalysisOutput;
}

const STORAGE_KEY = 'destiny_ai_v1';
const MAX_SAVED = 10;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getSavedAnalyses(): SavedAnalysis[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedAnalysis[]) : [];
  } catch {
    return [];
  }
}

export function saveAnalysis(
  data: Omit<SavedAnalysis, 'id' | 'createdAt'>
): SavedAnalysis {
  const list = getSavedAnalyses();
  const item: SavedAnalysis = {
    ...data,
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...list].slice(0, MAX_SAVED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return item;
}

export function deleteAnalysis(id: string): void {
  if (!isBrowser()) return;
  const next = getSavedAnalyses().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function formatSavedDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
