// One-off regression checks for opening, sharing and re-saving saved analyses.
//
//   npx -y tsx scripts/regression-saved-context.ts
//
// Uses an in-memory localStorage stub and exercises the same ActiveAnalysis
// helpers that app/page.tsx calls.

const store: Record<string, string> = {};
const g = globalThis as Record<string, unknown>;
g.window = globalThis;
g.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
};

import { analyzeDestiny, TAROT_DATA, type AnalysisOutput } from '../app/lib/analysis';
import { generateDestinyCode } from '../app/lib/destinyCode';
import { getSavedAnalyses, type SavedAnalysisMeta } from '../app/lib/storageEngine';
import {
  activeFromNewAnalysis,
  activeFromSaved,
  activeDestinyCode,
  activeShareText,
  saveActive,
} from '../app/lib/activeAnalysis';

const STORAGE_KEY = 'destiny_ai_v1';
let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) failures++;
}

function reset() {
  for (const k of Object.keys(store)) delete store[k];
}

const inputA = { nickname: '사용자A', birthdate: '1995-07-10', mbti: 'ISTJ', bloodtype: 'B' };
const inputB = { nickname: '사용자B', birthdate: '1990-05-15', mbti: 'INTJ', bloodtype: 'A' };

function analyzeA() {
  return analyzeDestiny(inputA.birthdate, '12:00', inputA.mbti, 'female', inputA.bloodtype, TAROT_DATA[21]);
}
function analyzeB() {
  return analyzeDestiny(inputB.birthdate, '14:30', inputB.mbti, 'male', inputB.bloodtype, TAROT_DATA[0], 37.5665, 126.978);
}

// Case A: analyze B → open saved A → displayed/copied Destiny Code belongs to A
{
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  const codeA = activeDestinyCode(a);
  saveActive(a);
  const b = activeFromNewAnalysis(analyzeB(), inputB);
  const codeB = activeDestinyCode(b);
  const opened = activeFromSaved(getSavedAnalyses()[0]);
  check('A: codes of A and B differ (test precondition)', codeA !== codeB, `${codeA} vs ${codeB}`);
  check('A: opened saved A shows A\'s Destiny Code', activeDestinyCode(opened) === codeA,
    `expected ${codeA}, got ${activeDestinyCode(opened)}`);
}

// Case B: fresh state → open saved A → sharing uses A's saved metadata
{
  reset();
  const snapA = analyzeA();
  saveActive(activeFromNewAnalysis(snapA, inputA));
  // "reload": nothing in memory but localStorage
  const opened = activeFromSaved(getSavedAnalyses()[0]);
  const text = activeShareText(opened);
  check('B: share text uses A\'s nickname', text.includes(`${inputA.nickname}의 운명 코드`), text.split('\n')[2]);
  check('B: share text does not use another name', !text.includes(inputB.nickname));
  check('B: Destiny Code restored after reload', activeDestinyCode(opened) === generateDestinyCode(snapA));
  check('B: opened meta equals saved meta', JSON.stringify(opened.meta) === JSON.stringify({
    ...inputA, keywords: snapA.commonKeywords, tarotName: snapA.tarot.name, zodiacSign: snapA.zodiac.sign,
  }));
}

// Case C: open legacy result → re-save → metadata preserved, stays legacy
{
  reset();
  // AnalysisOutput exactly as the pre-snapshot code stored it
  const legacyOutput: Record<string, unknown> = { ...analyzeA() };
  for (const k of ['schemaVersion', 'engineVersion', 'analysisId', 'createdAt', 'conflicts', 'keywordStrengths', 'coreTags']) {
    delete legacyOutput[k];
  }
  const legacyMeta: SavedAnalysisMeta = { ...inputA, keywords: ['옛 키워드'], tarotName: '옛 카드', zodiacSign: '게자리' };
  const legacyEntry = { ...legacyMeta, id: 'legacy1', createdAt: '2026-01-01T00:00:00.000Z', resultData: legacyOutput as unknown as AnalysisOutput };
  const original = JSON.stringify([legacyEntry]);
  store[STORAGE_KEY] = original;

  const opened = activeFromSaved(getSavedAnalyses()[0]);
  check('C: opened legacy entry is legacy', getSavedAnalyses()[0].kind === 'legacy');
  saveActive(opened);
  check('C: re-save leaves stored legacy entry byte-identical', store[STORAGE_KEY] === original);

  // Even if the entry was deleted meanwhile, re-saving keeps its own metadata and stays legacy.
  store[STORAGE_KEY] = '[]';
  const resaved = saveActive(opened);
  const withoutSaveTime = (o: object) => {
    const c: Record<string, unknown> = { ...o };
    delete c.createdAt;
    return JSON.stringify(c, Object.keys(c).sort());
  };
  check('C: re-save after delete keeps legacy kind', resaved.kind === 'legacy');
  check('C: re-save after delete keeps original id and metadata',
    withoutSaveTime(resaved) === withoutSaveTime({ ...legacyEntry, kind: 'legacy' }));
  check('C: re-saved result was not upgraded to a snapshot', !('schemaVersion' in resaved.resultData));
}

// Case D: save the same v2 analysis twice → one entry, unchanged
{
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  saveActive(a);
  const afterFirst = store[STORAGE_KEY];
  saveActive(a);
  // also re-save via the saved list, as the page does after opening it
  saveActive(activeFromSaved(getSavedAnalyses()[0]));
  const list = getSavedAnalyses();
  check('D: exactly one saved entry', list.length === 1, `got ${list.length}`);
  check('D: saved entry unchanged by repeated saves', store[STORAGE_KEY] === afterFirst);
  check('D: saved entry is v2 with the analysis ID', list[0].kind === 'v2' && list[0].id === (a.result as { analysisId: string }).analysisId);
}

if (failures) {
  console.log(`\nFAIL: ${failures} regression check(s) failed`);
  process.exit(1);
}
console.log('\nPASS: all saved-context regression checks');
