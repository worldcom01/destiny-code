// Regression checks for Identity catalog v3 (engine v3).
//
//   npx -y tsx scripts/regression-identity-catalog-v3.ts
//
// Engine v3 = Identity Selection v2 (unchanged) + one authored pair appended to the
// catalog: 창의적 + 독립적 → 고집스러운 실험가. Historical results stay frozen.

const store: Record<string, string> = {};
const g = globalThis as Record<string, unknown>;
g.window = globalThis;
g.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
};

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  analyzeDestiny, identityV1, TAROT_DATA, IDENTITY_PAIR_DEFINITIONS, IDENTITY_SINGLE_DEFINITIONS,
  ANALYSIS_ENGINE_VERSION, IDENTITY_PAIR_COUNT_BY_ENGINE,
  type AnalysisSnapshot, type CoreTag,
} from '../app/lib/analysis';
import type { AnalysisTrace, EvidenceRecord, InterpretationClaim } from '../app/lib/evidenceTrace';
import { selectIdentityV2, type IdentitySelectionReason } from '../app/lib/identitySelection';
import { generateDestinyCode } from '../app/lib/destinyCode';
import { getSavedAnalyses } from '../app/lib/storageEngine';
import { activeFromSaved, activeDestinyCode, saveActive } from '../app/lib/activeAnalysis';

const STORAGE_KEY = 'destiny_ai_v1';
const NEW_NAME = '고집스러운 실험가';
const NEW_SENTENCE = '주어진 방식을 따르기보다 자기 방법을 새로 만들지만, 이미 잘 돌아가는 것까지 다시 손대는 사람입니다.';
const NEW_INDEX = 10;
// git blob ids on main 74a039a (engine v2) — files engine v3 must not touch
const MAIN_BLOBS: Record<string, string> = {
  'app/lib/identitySelection.ts': 'd38dd083695ab1982bffc809adc5771ebcb991e6',
  'app/lib/analysisPatterns.ts': '391b0c21a1d2b9e5c3e1ac1f4b483ccb0ade55c5',
  'app/lib/evidenceTrace.ts': '2e49372bbf777ae201e14a1062ec62f84b120edc',
  'scripts/golden-baseline.v1.json': 'd79d1fa2a61558a741e640e02ce385a6f24d2958',
  'scripts/golden-baseline.v2.json': '96865c15477c4e15f50480ba191e28a86e91e14e',
};
// djb2 of JSON {pairs (engine v2 prefix), singles} — same as before engine v2
const CATALOG_DIGEST_V2 = '2a85c50';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) failures++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const blob = (path: string) => {
  const buf = readFileSync(join(__dirname, '..', path));
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
};
const LABEL_TO_TAG: Record<string, CoreTag> = {
  '창의적 사고': '창의적', '분석적 사고': '분석적', '감성적 공감': '감성적', '실용적 실행': '실용적', '뛰어난 사교성': '사교적',
  '강한 독립심': '독립적', '예리한 직관력': '직관적', '체계적 사고': '체계적', '넘치는 열정': '열정적', '따뜻한 포용력': '포용적',
};
const V2_PAIRS = IDENTITY_PAIR_DEFINITIONS.slice(0, IDENTITY_PAIR_COUNT_BY_ENGINE['2']);
const hasSingle = (t: CoreTag) => IDENTITY_SINGLE_DEFINITIONS[t] !== undefined;
const selectWith = (s: AnalysisSnapshot, pairs: typeof IDENTITY_PAIR_DEFINITIONS) => selectIdentityV2({
  trace: s.trace!, pairs, hasSingle, keywordTag: LABEL_TO_TAG[s.commonKeywords[0]], sajuFirstTag: s.saju.coreTags[0],
});
const archOf = (r: IdentitySelectionReason, pairs = IDENTITY_PAIR_DEFINITIONS) => r.pairIndex !== null ? pairs[r.pairIndex].archetype
  : r.decision === 'single' ? IDENTITY_SINGLE_DEFINITIONS[r.selectedTraits[0]]!.archetype : '복합적 패턴의 소유자';

// ── fixtures against the production catalog ──
const SAJU = 'saju:dominant-element', MBTI = 'mbti:type', BLOOD = 'blood-type:type', SUN = 'western-astrology:sun-sign';
const SOURCE: Record<string, string> = { [SAJU]: 'saju', [MBTI]: 'mbti', [BLOOD]: 'blood-type', [SUN]: 'western-astrology' };
const TARGET: Record<string, string> = { [SAJU]: 'saju.coreTags', [MBTI]: 'mbtiTraits.coreTags', [BLOOD]: 'bloodType.coreTags', [SUN]: 'zodiac.coreTags' };
function fixture(support: Partial<Record<CoreTag, string[]>>): AnalysisTrace {
  const used = new Set<string>();
  const claims: InterpretationClaim[] = [];
  for (const [trait, evs] of Object.entries(support) as Array<[CoreTag, string[]]>) {
    for (const e of evs) {
      used.add(e);
      claims.push({ id: `${e}:${trait}`, trait, evidenceIds: [e], ruleId: 'fixture@1', basis: 'symbolic', target: TARGET[e] });
    }
  }
  const evidence: EvidenceRecord[] = [...used].map((id) => ({ id, source: SOURCE[id], kind: 'calculated', feature: id, value: 'x', status: 'available' }));
  return { version: 1, evidence, claims };
}
const selectFixture = (support: Partial<Record<CoreTag, string[]>>, keywordTag: CoreTag) =>
  selectIdentityV2({ trace: fixture(support), pairs: IDENTITY_PAIR_DEFINITIONS, hasSingle, keywordTag, sajuFirstTag: undefined });

// 1 / 2. the new pair can be selected and carries the approved copy
{
  const def = IDENTITY_PAIR_DEFINITIONS[NEW_INDEX] as { tags: readonly CoreTag[]; archetype: string; identityStatement?: string };
  check('2 catalog entry #10 = 창의적+독립적 → 고집스러운 실험가 with the approved sentence',
    IDENTITY_PAIR_DEFINITIONS.length === 11 && eq(def.tags, ['창의적', '독립적']) && def.archetype === NEW_NAME
    && def.identityStatement === NEW_SENTENCE, JSON.stringify(def));
  const r = selectFixture({ 창의적: [SAJU, BLOOD], 독립적: [MBTI, BLOOD] }, '창의적');
  check('1 fixture: representative 창의적 + both tags cross-source → pair #10', r.pairIndex === NEW_INDEX && r.decision === 'ranked-pair');
  const s = analyzeDestiny('1985-12-01', '', 'ENFP', 'female', 'B', TAROT_DATA[5]);
  check('1/2 real analysis selects 고집스러운 실험가 with the exact approved sentence',
    s.archetype === NEW_NAME && s.identityStatement === NEW_SENTENCE && s.identitySelection?.pairIndex === NEW_INDEX,
    `${s.archetype} / ${s.identityStatement}`);
}

// 3 / 4. Option B ranking and representative priority are unchanged
{
  const files = ['app/lib/identitySelection.ts', 'app/lib/analysisPatterns.ts', 'app/lib/evidenceTrace.ts'];
  check('3 selector / pattern / provenance sources are byte-identical to engine v2 (main)',
    files.every((f) => blob(f) === MAIN_BLOBS[f]), files.map((f) => `${f}=${blob(f)}`).join(' '));
  // tie between #3 (체계적+창의적) and #10 (창의적+독립적): earlier authored pair wins
  const tie = selectFixture({ 창의적: [SAJU, BLOOD], 체계적: [MBTI], 독립적: [SUN] }, '창의적');
  check('3 full tuple tie → existing earlier pair (#3) beats appended #10', tie.pairIndex === 3 && tie.usedAuthoredOrder, JSON.stringify(tie));
  // #10 has the larger source union (4 vs 2), but only #3 contains the representative tag 체계적
  const rep = selectFixture({ 체계적: [MBTI, SUN], 창의적: [MBTI, SUN], 독립적: [SAJU, BLOOD] }, '체계적');
  check('4 representative convergence still outranks a pair with larger union', rep.pairIndex === 3, JSON.stringify(rep)); // #3 ties only with its duplicate #8
  // with equal representative and #10 stronger on min, #10 wins
  const min = selectFixture({ 창의적: [SAJU, BLOOD], 체계적: [MBTI], 독립적: [SUN, MBTI] }, '창의적');
  check('3 same representative, larger min → #10', min.pairIndex === NEW_INDEX && !min.usedAuthoredOrder, JSON.stringify(min));
}

// 5. no-convergence fallback is the v2 rule (first authored candidate)
{
  const both = selectFixture({ 창의적: [SAJU], 독립적: [MBTI], 포용적: [BLOOD] }, '창의적');
  check('5 no convergence: #0 (독립적+포용적) precedes appended #10', both.decision === 'no-convergence-pair' && both.pairIndex === 0);
  const only = selectFixture({ 창의적: [SAJU], 독립적: [MBTI] }, '창의적');
  check('5 no convergence, only #10 eligible → #10 (first candidate)', only.decision === 'no-convergence-pair' && only.pairIndex === NEW_INDEX);
}

// 6 / 7. existing catalog entries and duplicate behavior unchanged
{
  const j = JSON.stringify({ pairs: IDENTITY_PAIR_DEFINITIONS.slice(0, IDENTITY_PAIR_COUNT_BY_ENGINE['2']), singles: IDENTITY_SINGLE_DEFINITIONS });
  let h = 5381;
  for (const ch of j) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  check('6 existing 21 definitions (pairs #0–#9, singles, text, order) unchanged', (h >>> 0).toString(16) === CATALOG_DIGEST_V2);
  check('6 engine catalog sizes: v1 10, v2 10, v3 11',
    eq(IDENTITY_PAIR_COUNT_BY_ENGINE, { '1': 10, '2': 10, '3': 11 }) && IDENTITY_PAIR_DEFINITIONS.length === IDENTITY_PAIR_COUNT_BY_ENGINE[ANALYSIS_ENGINE_VERSION]);
  const dup = selectFixture({ 창의적: [SAJU, BLOOD], 체계적: [MBTI, BLOOD] }, '창의적');
  check('7 duplicate pair #8 (= #3) is still never selected', dup.pairIndex === 3);
}

// 8 / 9 / 10. saved engine v1 and v2 results stay frozen; Destiny Code uses the stored archetype
{
  const s = analyzeDestiny('1985-12-01', '', 'ENFP', 'female', 'B', TAROT_DATA[5]); // v3 → 고집스러운 실험가
  const v2Sel = selectWith(s, V2_PAIRS);
  const v2Snapshot: Record<string, unknown> = { ...s, engineVersion: '2', archetype: archOf(v2Sel, V2_PAIRS),
    identityStatement: '사람들 속에서 에너지가 올라가는데, 그 안에서도 혼자라는 감각을 자주 느끼는 사람입니다.', identitySelection: v2Sel };
  const v1Snapshot: Record<string, unknown> = { ...s, engineVersion: '1', ...identityV1(s) };
  delete v1Snapshot.identitySelection;
  const meta = { nickname: 'h', birthdate: '1985-12-01', mbti: 'ENFP', bloodtype: 'B', keywords: [], tarotName: 't', zodiacSign: 'z' };
  const stored = JSON.stringify([
    { ...meta, id: 'engine2', createdAt: '2026-09-30T00:00:00.000Z', resultData: v2Snapshot },
    { ...meta, id: 'engine1', createdAt: '2026-09-01T00:00:00.000Z', resultData: v1Snapshot },
  ]);
  store[STORAGE_KEY] = stored;
  const [e2, e1] = getSavedAnalyses();
  check('9 saved engine-v2 result loads unchanged (not re-selected with the v3 catalog)',
    eq(e2.resultData, v2Snapshot) && e2.resultData.archetype === '군중 속의 고독자' && (e2.resultData as AnalysisSnapshot).engineVersion === '2');
  check('8 saved engine-v1 result loads unchanged', eq(e1.resultData, v1Snapshot) && !('identitySelection' in e1.resultData));
  check('10 historical Destiny Codes come from the stored archetypes',
    activeDestinyCode(activeFromSaved(e2)) === generateDestinyCode(v2Snapshot as unknown as AnalysisSnapshot)
    && activeDestinyCode(activeFromSaved(e1)) === generateDestinyCode(v1Snapshot as unknown as AnalysisSnapshot)
    && activeDestinyCode(activeFromSaved(e2)) !== generateDestinyCode(s));
  saveActive(activeFromSaved(e2));
  saveActive(activeFromSaved(e1));
  check('8/9 re-saving historical results leaves storage byte-identical', store[STORAGE_KEY] === stored);
}

// 11. new analyses
{
  const s = analyzeDestiny('1990-05-15', '14:30', 'INTJ', 'male', 'A', TAROT_DATA[0], 37.5665, 126.978);
  check('11 new analysis: engineVersion "3", schemaVersion 2, selection@2 reason',
    ANALYSIS_ENGINE_VERSION === '3' && s.engineVersion === '3' && s.schemaVersion === 2 && s.identitySelection?.ruleId === 'identity.selection@2');
}

// 12 / 13. historical golden baselines untouched
check('12 golden-baseline.v1.json blob unchanged', blob('scripts/golden-baseline.v1.json') === MAIN_BLOBS['scripts/golden-baseline.v1.json']);
check('13 golden-baseline.v2.json blob unchanged', blob('scripts/golden-baseline.v2.json') === MAIN_BLOBS['scripts/golden-baseline.v2.json']);

// 14 / 16. determinism
{
  const strip = (s: AnalysisSnapshot) => JSON.stringify({ ...s, analysisId: '', createdAt: '' });
  const run = () => analyzeDestiny('1978-08-15', '22:00', 'ISTP', 'male', 'AB', TAROT_DATA[15], 33.4996, 126.5312, 'lunar', false);
  const a = run(), b = run();
  check('14/16 identical input → identical v3 snapshot (identity, selection, trace)', strip(a) === strip(b));
  const golden = JSON.parse(readFileSync(join(__dirname, 'golden-baseline.v3.json'), 'utf8')) as Array<{ result: { output: { archetype: string } } }>;
  check('14 v3 golden case matches a fresh analysis', golden[3].result.output.archetype === a.archetype);
}

// 15. catalog order causes no unrelated change: over a systematic input grid, every v2 → v3
// difference is a selection of the appended pair, and the v2 selector reproduces engine v2
{
  const DATES = ['1950-03-02', '1961-07-19', '1973-01-28', '1984-10-05', '1992-04-05', '1999-12-24', '2006-06-11'];
  const MBTIS = ['', 'INFJ', 'INTP', 'ENFP', 'ESTJ', 'ISFP', 'ENTJ'];
  let n = 0, changed = 0, unrelated = 0, narrativeHasIdentity = 0;
  for (const d of DATES) for (const m of MBTIS) for (const bl of ['A', 'B', 'O', 'AB']) for (const t of ['', '08:30']) {
    const s = analyzeDestiny(d, t, m, 'male', bl, TAROT_DATA[0], t ? 37.5665 : undefined, t ? 126.978 : undefined);
    const v2 = selectWith(s, V2_PAIRS);
    n++;
    if (archOf(v2, V2_PAIRS) !== s.archetype) {
      changed++;
      if (s.identitySelection?.pairIndex !== NEW_INDEX) unrelated++;
    }
    if (s.detailedReading.sections.some((sec) => sec.content.includes(s.identityStatement))) narrativeHasIdentity++;
  }
  check(`15 grid of ${n}: every v2 → v3 change (${changed}) selects the appended pair`, changed > 0 && unrelated === 0, `unrelated ${unrelated}`);
  check('15 Identity sentence is not duplicated into the narrative sections', narrativeHasIdentity === 0);
}

if (failures) {
  console.log(`\nFAIL: ${failures} identity-catalog-v3 check(s) failed`);
  process.exit(1);
}
console.log('\nPASS: all identity-catalog-v3 regression checks');
