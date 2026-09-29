// Regression checks for Identity Selection v2 (engine v2).
//
//   npx -y tsx scripts/regression-identity-selection.ts
//
// Ranking (lexicographic, descending): contains representative convergence tag →
// min distinct-source support of the two tags → distinct-source union → authored
// order (pairIndex ascending). No convergence → engine v1 behavior.

const store: Record<string, string> = {};
const g = globalThis as Record<string, unknown>;
g.window = globalThis;
g.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
};

import {
  analyzeDestiny, identityV1, TAROT_DATA, IDENTITY_PAIR_DEFINITIONS, IDENTITY_SINGLE_DEFINITIONS,
  type AnalysisSnapshot, type CoreTag,
} from '../app/lib/analysis';
import type { AnalysisTrace, EvidenceRecord, InterpretationClaim } from '../app/lib/evidenceTrace';
import { selectIdentityV2 } from '../app/lib/identitySelection';
import { generateDestinyCode } from '../app/lib/destinyCode';
import { getSavedAnalyses } from '../app/lib/storageEngine';
import { activeFromNewAnalysis, activeFromSaved, activeDestinyCode, saveActive } from '../app/lib/activeAnalysis';

const STORAGE_KEY = 'destiny_ai_v1';
// djb2 of JSON {pairs, singles} on main 2746b5e (before engine v2)
const CATALOG_DIGEST_V1 = '2a85c50';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) failures++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── fixture helpers ──
const SAJU = 'saju:dominant-element', SAJU_MISSING = 'saju:first-missing-element', MBTI = 'mbti:type',
  BLOOD = 'blood-type:type', SUN = 'western-astrology:sun-sign', MOON = 'western-astrology:moon-sign', TAROT = 'tarot:card-number';
const SOURCE: Record<string, string> = {
  [SAJU]: 'saju', [SAJU_MISSING]: 'saju', [MBTI]: 'mbti', [BLOOD]: 'blood-type',
  [SUN]: 'western-astrology', [MOON]: 'western-astrology', [TAROT]: 'tarot',
};
const TARGET: Record<string, string> = {
  [SAJU]: 'saju.coreTags', [SAJU_MISSING]: 'saju.coreTags', [MBTI]: 'mbtiTraits.coreTags', [BLOOD]: 'bloodType.coreTags',
  [SUN]: 'westernAstrology.sun.data.coreTags', [MOON]: 'westernAstrology.moon.data.coreTags', [TAROT]: 'tarot.coreTags',
};
type Support = Partial<Record<CoreTag, Array<string>>>; // trait -> evidence ids ('zodiac' = zodiac path on SUN)

function fixture(support: Support, missing: string[] = []): AnalysisTrace {
  const usedEvidence = new Set<string>();
  const claims: InterpretationClaim[] = [];
  for (const [trait, evs] of Object.entries(support) as Array<[CoreTag, string[]]>) {
    for (const e of evs) {
      const isZodiac = e === 'zodiac';
      const evId = isZodiac ? SUN : e;
      usedEvidence.add(evId);
      claims.push({
        id: `${isZodiac ? 'zodiac:sun-sign' : evId}:${trait}`, trait, evidenceIds: [evId],
        ruleId: 'fixture@1', basis: 'symbolic', target: isZodiac ? 'zodiac.coreTags' : TARGET[evId],
      });
    }
  }
  const evidence: EvidenceRecord[] = [...usedEvidence].map((id) => ({
    id, source: SOURCE[id], kind: 'calculated', feature: id, value: missing.includes(id) ? null : 'x',
    status: missing.includes(id) ? 'missing' : 'available',
  }));
  return { version: 1, evidence, claims };
}
const select = (trace: AnalysisTrace, pairs: Array<[CoreTag, CoreTag]>, keywordTag: CoreTag | undefined,
  opts: { sajuFirstTag?: CoreTag; hasSingle?: (t: CoreTag) => boolean } = {}) =>
  selectIdentityV2({
    trace, pairs: pairs.map((tags) => ({ tags })), keywordTag,
    sajuFirstTag: opts.sajuFirstTag, hasSingle: opts.hasSingle ?? (() => true),
  });

const R: CoreTag = '독립적';
const R_SUPPORT = [SAJU, BLOOD]; // representative: 2 sources

// 1. determinism
{
  const t = fixture({ [R]: R_SUPPORT, 분석적: [MBTI], 감성적: [SUN] });
  const pairs: Array<[CoreTag, CoreTag]> = [['분석적', '감성적'], [R, '분석적']];
  check('1 deterministic selection (fixture)', eq(select(t, pairs, R), select(t, pairs, R)));
}

// 2. representative convergence outranks an earlier, otherwise stronger pair
{
  const t = fixture({ [R]: R_SUPPORT, 분석적: [SAJU, MBTI], 감성적: [BLOOD, MBTI], 포용적: [MBTI] });
  const r = select(t, [['분석적', '감성적'], [R, '포용적']], R);
  check('2 pair containing the representative tag wins over an earlier pair without it',
    r.decision === 'ranked-pair' && r.pairIndex === 1 && r.representativeTrait === R && !r.usedAuthoredOrder, JSON.stringify(r));
}

// 3. among representative pairs, larger min support wins
{
  const t = fixture({ [R]: R_SUPPORT, 포용적: [MBTI], 감성적: [MBTI, 'zodiac'] });
  const r = select(t, [[R, '포용적'], [R, '감성적']], R);
  check('3 stronger min(source support) wins among representative pairs', r.pairIndex === 1 && !r.usedAuthoredOrder, JSON.stringify(r));
}

// 4. union coverage resolves the next tie
{
  const t = fixture({ [R]: R_SUPPORT, 포용적: [SAJU], 감성적: [MBTI] });
  const r = select(t, [[R, '포용적'], [R, '감성적']], R);
  check('4 larger distinct-source union wins when min is tied', r.pairIndex === 1 && !r.usedAuthoredOrder, JSON.stringify(r));
}

// 3/4. min support outranks union coverage when they disagree
{
  // [R, 감성적]: min 1, union 3 — [R, 포용적]: min 2, union 2 (both tags on the same two sources)
  const t = fixture({ [R]: R_SUPPORT, 포용적: [SAJU, BLOOD], 감성적: [MBTI] });
  const r = select(t, [[R, '감성적'], [R, '포용적']], R);
  check('3/4 higher min beats larger union (min is compared first)', r.pairIndex === 1 && !r.usedAuthoredOrder, JSON.stringify(r));
}

// 5. authored order is the final tie-breaker
{
  const t = fixture({ [R]: R_SUPPORT, 포용적: [MBTI], 감성적: ['zodiac'] });
  const a = select(t, [[R, '포용적'], [R, '감성적']], R);
  const b = select(t, [[R, '감성적'], [R, '포용적']], R);
  check('5 full tie → lowest pairIndex, recorded as authored order',
    a.pairIndex === 0 && eq(a.selectedTraits, [R, '포용적']) && a.usedAuthoredOrder
    && b.pairIndex === 0 && eq(b.selectedTraits, [R, '감성적']) && b.usedAuthoredOrder);
}

// 6. no convergence → engine v1 behavior
{
  const t = fixture({ 분석적: [SAJU], 감성적: [MBTI], 포용적: [BLOOD] });
  const r = select(t, [['체계적', '창의적'], ['분석적', '감성적'], ['분석적', '포용적']], '분석적');
  check('6 no convergence → first authored candidate (v1 order)',
    r.decision === 'no-convergence-pair' && r.pairIndex === 1 && r.representativeTrait === null && r.usedAuthoredOrder, JSON.stringify(r));
  const single = select(t, [['체계적', '창의적']], '감성적', { sajuFirstTag: '분석적' });
  check('6 no pair → single from commonKeywords[0] (v1)', single.decision === 'single' && eq(single.selectedTraits, ['감성적']));
  const sajuFallback = select(t, [['체계적', '창의적']], undefined, { sajuFirstTag: '분석적' });
  check('6 no pair, no keyword → single from saju first tag (v1)', sajuFallback.decision === 'single' && eq(sajuFallback.selectedTraits, ['분석적']));
  const generic = select(t, [['체계적', '창의적']], '감성적', { hasSingle: () => false });
  check('6 no pair, no single definition → generic (v1)', generic.decision === 'generic' && generic.support.length === 0);
}

// 7. same-source duplicate evidence (saju dominant + compensation) does not inflate support
{
  const t = fixture({ [R]: R_SUPPORT, 포용적: [MBTI], 감성적: [SAJU, SAJU_MISSING] });
  const r = select(t, [[R, '포용적'], [R, '감성적']], R);
  const dup = select(t, [[R, '감성적']], R);
  check('7/9 saju dominant + compensation counts as one source',
    r.pairIndex === 0 && eq(dup.support[1].sources, ['saju']) && dup.support[1].claimIds.length === 2, JSON.stringify(r));
}

// 8. zodiac path + Sun placement share one evidence; Sun + Moon are one source
{
  const t = fixture({ [R]: R_SUPPORT, 포용적: [MBTI], 감성적: ['zodiac', SUN] });
  const r = select(t, [[R, '포용적'], [R, '감성적']], R);
  const z = select(t, [[R, '감성적']], R);
  check('8 zodiac + Sun do not double-count', r.pairIndex === 0 && eq(z.support[1].sources, ['western-astrology']), JSON.stringify(r));
  const t2 = fixture({ [R]: R_SUPPORT, 포용적: [MBTI], 감성적: ['zodiac', MOON] });
  check('8 Sun + Moon count as one western-astrology source', select(t2, [[R, '포용적'], [R, '감성적']], R).pairIndex === 0);
}

// 10. missing evidence does not fabricate support
{
  const t = fixture({ [R]: R_SUPPORT, 포용적: [MBTI], 감성적: ['zodiac', BLOOD] }, [BLOOD]);
  // BLOOD missing: 감성적 keeps only western; R also loses blood-type → R has 1 source, so no convergence remains
  const r = select(t, [[R, '포용적'], [R, '감성적']], R);
  check('10 missing evidence removes support (no convergence left → v1 order)',
    r.decision === 'no-convergence-pair' && r.pairIndex === 0 && r.representativeTrait === null, JSON.stringify(r));
  const t2 = fixture({ [R]: [SAJU, 'zodiac'], 포용적: [MBTI], 감성적: [SAJU, BLOOD] }, [BLOOD]);
  const r2 = select(t2, [[R, '감성적']], R);
  check('10 support lists only available claims and sources',
    eq(r2.support[1], { trait: '감성적', claimIds: [`${SAJU}:감성적`], sources: ['saju'] }), JSON.stringify(r2));
}

// 11. Tarot does not affect selection
{
  const t = fixture({ [R]: R_SUPPORT, 포용적: [MBTI], 감성적: [TAROT, 'zodiac'] });
  const r = select(t, [[R, '포용적'], [R, '감성적']], R);
  const tt = select(t, [[R, '감성적']], R);
  check('11 tarot claims add no ranking support',
    r.pairIndex === 0 && eq(tt.support[1].sources, ['western-astrology']) && tt.support[1].claimIds.length === 1, JSON.stringify(tt));
  const onlyTarot = fixture({ [R]: R_SUPPORT, 감성적: [TAROT] });
  const s = select(onlyTarot, [[R, '감성적']], R);
  check('11 tarot-only tag cannot form a candidate', s.decision === 'single' && eq(s.selectedTraits, [R]));
}

// candidate eligibility stays the authored-pair scope: Moon-only tags form no candidate
{
  const t = fixture({ [R]: R_SUPPORT, 감성적: [MOON] });
  const r = select(t, [[R, '감성적']], R);
  check('moon-only tag cannot form a candidate (eligibility unchanged)', r.decision === 'single');
}

// representative invariant
{
  const t = fixture({ [R]: R_SUPPORT, 포용적: [MBTI] });
  let threw = false;
  try { select(t, [[R, '포용적']], '포용적'); } catch { threw = true; }
  check('keyword that is not a max-support convergence trait is rejected', threw);
}

// ── real analyses ──
const INPUTS = [
  ['1990-05-15', '14:30', 'INTJ', 'A', 0, 37.5665, 126.978],
  ['1985-12-01', '', 'ENFP', 'B', 5, undefined, undefined],
  ['2000-02-29', '06:00', '', 'O', 10, 35.1796, 129.0756],
  ['1978-08-15', '22:00', 'ISTP', 'AB', 15, 33.4996, 126.5312],
  ['1995-07-10', '12:00', 'ISTJ', 'B', 21, undefined, undefined],
  ['1988-09-01', '08:00', 'INFJ', 'O', 7, 37.5665, 126.978],
  ['1971-02-11', '', 'ESTP', 'A', 13, undefined, undefined],
  ['2003-10-30', '20:30', 'ISFJ', 'AB', 18, 35.1796, 129.0756],
] as const;
const analyze = (x: (typeof INPUTS)[number], card = TAROT_DATA[x[4]]): AnalysisSnapshot =>
  analyzeDestiny(x[0], x[1], x[2], 'male', x[3], card, x[5], x[6]);
const LABEL_TO_TAG: Record<string, CoreTag> = {
  '창의적 사고': '창의적', '분석적 사고': '분석적', '감성적 공감': '감성적', '실용적 실행': '실용적', '뛰어난 사교성': '사교적',
  '강한 독립심': '독립적', '예리한 직관력': '직관적', '체계적 사고': '체계적', '넘치는 열정': '열정적', '따뜻한 포용력': '포용적',
};

for (const x of INPUTS) {
  const p = `[${x[0]} ${x[2] || 'no-mbti'}]`;
  const s = analyze(x);
  const r = s.identitySelection!;
  const tr = s.trace!;
  check(`${p} 13/14 engineVersion '2', schemaVersion 2, selection recorded`,
    s.engineVersion === '2' && s.schemaVersion === 2 && !!r && r.version === 1 && r.ruleId === 'identity.selection@2');
  check(`${p} 1 deterministic across repeated analyses`, eq(analyze(x).identitySelection, r) && analyze(x).archetype === s.archetype);
  check(`${p} 11 different tarot card → same selection`,
    eq(analyze(x, TAROT_DATA[(x[4] + 9) % TAROT_DATA.length]).identitySelection, r));

  // archetype comes from the one catalog
  const expectedArch = r.pairIndex !== null ? IDENTITY_PAIR_DEFINITIONS[r.pairIndex].archetype
    : r.decision === 'single' ? IDENTITY_SINGLE_DEFINITIONS[r.selectedTraits[0]]?.archetype : '복합적 패턴의 소유자';
  check(`${p} archetype matches catalog entry of the decision`, expectedArch === s.archetype, `${expectedArch} vs ${s.archetype}`);
  if (r.pairIndex !== null) check(`${p} selectedTraits = catalog pair`, eq(r.selectedTraits, IDENTITY_PAIR_DEFINITIONS[r.pairIndex].tags));

  // representative = commonKeywords[0] when there is convergence
  if (r.representativeTrait) check(`${p} representative = commonKeywords[0]`, r.representativeTrait === LABEL_TO_TAG[s.commonKeywords[0]]);
  if (r.decision === 'no-convergence-pair' || r.decision === 'single' || r.decision === 'generic') {
    check(`${p} 6 non-ranked path equals engine v1 Identity`, identityV1(s).archetype === s.archetype);
  }

  // reason provenance points into the same trace, available evidence only
  const available = new Set(tr.evidence.filter((e) => e.status === 'available').map((e) => e.id));
  const sourceOf = new Map(tr.evidence.map((e) => [e.id, e.source]));
  check(`${p} reason claimIds exist, match trait, and use available evidence; sources match`, r.support.every((sp) => {
    const cls = sp.claimIds.map((id) => tr.claims.find((c) => c.id === id));
    const srcs = [...new Set(cls.flatMap((c) => c?.evidenceIds.map((id) => sourceOf.get(id)!) ?? []))].sort();
    return cls.every((c) => c && c.trait === sp.trait && c.evidenceIds.every((id) => available.has(id)))
      && eq(srcs, sp.sources) && !sp.sources.includes('tarot');
  }));
  check(`${p} support follows selectedTraits order`, eq(r.support.map((sp) => sp.trait), r.selectedTraits));

  // evidence / claim array order does not change the decision
  const reversed: AnalysisTrace = { ...tr, evidence: [...tr.evidence].reverse(), claims: [...tr.claims].reverse() };
  const again = selectIdentityV2({
    trace: reversed, pairs: IDENTITY_PAIR_DEFINITIONS, hasSingle: (t) => IDENTITY_SINGLE_DEFINITIONS[t] !== undefined,
    keywordTag: LABEL_TO_TAG[s.commonKeywords[0]], sajuFirstTag: s.saju.coreTags[0],
  });
  check(`${p} reversed evidence/claim order → identical selection`, eq(again, r), JSON.stringify(again));
}

// ── 12. saved engine-v1 analyses are frozen ──
{
  store[STORAGE_KEY] = '[]';
  const s = analyze(INPUTS[0]);
  const v1 = identityV1(s);
  const v1Snapshot: Record<string, unknown> = { ...s, engineVersion: '1', ...v1 };
  delete v1Snapshot.identitySelection;
  const meta = { nickname: 'v1', birthdate: '1990-05-15', mbti: 'INTJ', bloodtype: 'A', keywords: [], tarotName: 't', zodiacSign: 'z' };
  const stored = JSON.stringify([{ ...meta, id: 'engine1', createdAt: '2026-09-01T00:00:00.000Z', resultData: v1Snapshot }]);
  store[STORAGE_KEY] = stored;
  const loaded = getSavedAnalyses()[0];
  check('12 engine-v1 snapshot loads unchanged (no recompute, no identitySelection)',
    loaded.kind === 'v2' && eq(loaded.resultData, v1Snapshot) && !('identitySelection' in loaded.resultData)
    && (loaded.resultData as AnalysisSnapshot).engineVersion === '1');
  const active = activeFromSaved(loaded);
  check('12 engine-v1 Destiny Code comes from the stored v1 archetype',
    activeDestinyCode(active) === generateDestinyCode(v1Snapshot as unknown as AnalysisSnapshot));
  saveActive(active);
  check('12 re-saving an engine-v1 result leaves storage byte-identical', store[STORAGE_KEY] === stored);
}

// ── 13/14. new engine-v2 snapshot round-trip ──
{
  store[STORAGE_KEY] = '[]';
  const s = analyze(INPUTS[4]);
  saveActive(activeFromNewAnalysis(s, { nickname: 'n', birthdate: '1995-07-10', mbti: 'ISTJ', bloodtype: 'B' }));
  const afterFirst = store[STORAGE_KEY];
  const loaded = getSavedAnalyses()[0];
  check('13/14 engine-v2 snapshot round-trips deep-equal (engineVersion 2, schemaVersion 2, selection kept)',
    loaded.kind === 'v2' && eq(loaded.resultData, s) && (loaded.resultData as AnalysisSnapshot).engineVersion === '2'
    && (loaded.resultData as AnalysisSnapshot).schemaVersion === 2 && eq((loaded.resultData as AnalysisSnapshot).identitySelection, s.identitySelection));
  saveActive(activeFromSaved(loaded));
  check('13 duplicate save of an engine-v2 analysis leaves storage untouched', store[STORAGE_KEY] === afterFirst);
}

// ── 15. catalog definitions / order unchanged ──
{
  const j = JSON.stringify({ pairs: IDENTITY_PAIR_DEFINITIONS, singles: IDENTITY_SINGLE_DEFINITIONS });
  let h = 5381;
  for (const ch of j) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  check('15 Identity catalog (pairs, singles, order, text) unchanged from engine v1',
    (h >>> 0).toString(16) === CATALOG_DIGEST_V1 && IDENTITY_PAIR_DEFINITIONS.length === 10, (h >>> 0).toString(16));
}

if (failures) {
  console.log(`\nFAIL: ${failures} identity-selection check(s) failed`);
  process.exit(1);
}
console.log('\nPASS: all identity-selection regression checks');
