// One-off regression checks for Phase 2B observational patterns.
//
//   npx -y tsx scripts/regression-analysis-patterns.ts
//
// deriveAnalysisPatterns() must be a pure, provenance-aware reading of the
// Phase 2A trace. It must not feed or change any existing analysis output.

import {
  analyzeDestiny, identityV1, TAROT_DATA, IDENTITY_PAIR_DEFINITIONS,
  type AnalysisSnapshot, type CoreTag,
} from '../app/lib/analysis';
import type { AnalysisTrace, EvidenceRecord, InterpretationClaim } from '../app/lib/evidenceTrace';
import {
  deriveAnalysisPatterns,
  type AnalysisPattern, type AuthoredPairPattern, type ConvergencePattern,
} from '../app/lib/analysisPatterns';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) failures++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const convergence = (ps: AnalysisPattern[]) => ps.filter((p): p is ConvergencePattern => p.kind === 'convergence');
const pairs = (ps: AnalysisPattern[]) => ps.filter((p): p is AuthoredPairPattern => p.kind === 'authored-pair');

// ── fixture helpers ──
function ev(id: string, source: string, status: EvidenceRecord['status'] = 'available'): EvidenceRecord {
  return { id, source, kind: 'calculated', feature: id, value: status === 'available' ? 'x' : null, status };
}
function cl(evidenceId: string, trait: CoreTag, target: string, prefix = evidenceId): InterpretationClaim {
  return { id: `${prefix}:${trait}`, trait, evidenceIds: [evidenceId], ruleId: 'fixture@1', basis: 'symbolic', target };
}
const trace = (evidence: EvidenceRecord[], claims: InterpretationClaim[]): AnalysisTrace => ({ version: 1, evidence, claims });
const SUN = 'western-astrology:sun-sign';

// ── convergence rules ──
{
  const t = trace(
    [ev('saju:dominant-element', 'saju'), ev('blood-type:type', 'blood-type')],
    [cl('saju:dominant-element', '독립적', 'saju.coreTags'), cl('blood-type:type', '독립적', 'bloodType.coreTags')],
  );
  const c = convergence(deriveAnalysisPatterns(t, []));
  check('two distinct sources → convergence', c.length === 1 && eq(c[0].sources, ['saju', 'blood-type']) && c[0].trait === '독립적');
}
{
  const t = trace([ev('mbti:type', 'mbti')], [cl('mbti:type', '분석적', 'mbtiTraits.coreTags')]);
  check('one source alone → no convergence', convergence(deriveAnalysisPatterns(t, [])).length === 0);
}
{
  const t = trace(
    [ev('saju:dominant-element', 'saju'), ev('saju:first-missing-element', 'saju')],
    [cl('saju:dominant-element', '직관적', 'saju.coreTags'), cl('saju:first-missing-element', '직관적', 'saju.coreTags')],
  );
  check('saju dominant + missing paths (same source) → no convergence', convergence(deriveAnalysisPatterns(t, [])).length === 0);
}
{
  // zodiac path and sun placement share one Evidence: must not count twice
  const t = trace([ev(SUN, 'western-astrology')], [
    cl(SUN, '열정적', 'zodiac.coreTags', 'zodiac:sun-sign'),
    cl(SUN, '열정적', 'westernAstrology.sun.data.coreTags'),
  ]);
  check('zodiac + sun placement (shared evidence) → no convergence', convergence(deriveAnalysisPatterns(t, [])).length === 0);
}
{
  // sun and moon are distinct evidence but the same source system (one set in the intersection)
  const t = trace([ev(SUN, 'western-astrology'), ev('western-astrology:moon-sign', 'western-astrology')], [
    cl(SUN, '감성적', 'westernAstrology.sun.data.coreTags'),
    cl('western-astrology:moon-sign', '감성적', 'westernAstrology.moon.data.coreTags'),
  ]);
  check('sun + moon (same source) → no convergence', convergence(deriveAnalysisPatterns(t, [])).length === 0);
}
{
  const t = trace([ev(SUN, 'western-astrology'), ev('saju:dominant-element', 'saju')], [
    cl(SUN, '열정적', 'zodiac.coreTags', 'zodiac:sun-sign'),
    cl(SUN, '열정적', 'westernAstrology.sun.data.coreTags'),
    cl('saju:dominant-element', '열정적', 'saju.coreTags'),
  ]);
  const c = convergence(deriveAnalysisPatterns(t, []));
  check('zodiac + sun + saju → 2 sources, 2 distinct evidence, 3 claims',
    c.length === 1 && eq(c[0].sources, ['western-astrology', 'saju'])
    && eq(c[0].evidenceIds, [SUN, 'saju:dominant-element']) && c[0].claimIds.length === 3, JSON.stringify(c));
}
{
  const t = trace([ev('tarot:card-number', 'tarot'), ev('mbti:type', 'mbti')], [
    cl('tarot:card-number', '창의적', 'tarot.coreTags'),
    cl('mbti:type', '창의적', 'mbtiTraits.coreTags'),
  ]);
  check('tarot does not count toward convergence', convergence(deriveAnalysisPatterns(t, [])).length === 0);
}
{
  // a claim whose evidence is missing (malformed) must not become support
  const t = trace([ev('mbti:type', 'mbti', 'missing'), ev('blood-type:type', 'blood-type')], [
    cl('mbti:type', '체계적', 'mbtiTraits.coreTags'),
    cl('blood-type:type', '체계적', 'bloodType.coreTags'),
  ]);
  const ps = deriveAnalysisPatterns(t, [{ tags: ['체계적', '감성적'] }]);
  check('missing evidence does not fabricate convergence', convergence(ps).length === 0);
}
{
  // authored-pair contrast: identical claims, only the MBTI evidence status differs
  const PAIR = [{ tags: ['체계적', '감성적'] as [CoreTag, CoreTag] }];
  const make = (mbtiStatus: EvidenceRecord['status'], withSaju: boolean) => trace(
    [ev('mbti:type', 'mbti', mbtiStatus), ev('blood-type:type', 'blood-type'),
      ...(withSaju ? [ev('saju:dominant-element', 'saju')] : [])],
    [cl('mbti:type', '체계적', 'mbtiTraits.coreTags'), cl('mbti:type', '감성적', 'mbtiTraits.coreTags'),
      cl('blood-type:type', '체계적', 'bloodType.coreTags'),
      ...(withSaju ? [cl('saju:dominant-element', '감성적', 'saju.coreTags')] : [])],
  );
  const available = pairs(deriveAnalysisPatterns(make('available', false), PAIR));
  check('pair contrast: available evidence → pair with MBTI support and shared source',
    available.length === 1
    && eq(available[0].support[0], { claimIds: ['mbti:type:체계적', 'blood-type:type:체계적'], sources: ['mbti', 'blood-type'] })
    && eq(available[0].support[1], { claimIds: ['mbti:type:감성적'], sources: ['mbti'] })
    && eq(available[0].sharedSources, ['mbti']), JSON.stringify(available));
  const missing = pairs(deriveAnalysisPatterns(make('missing', false), PAIR));
  check('pair contrast: same claims with missing evidence → no pair', missing.length === 0, JSON.stringify(missing));
  // other side still supported by available evidence: only available paths appear
  const mixed = pairs(deriveAnalysisPatterns(make('missing', true), PAIR));
  check('pair with missing evidence: support lists only available claims and sources',
    mixed.length === 1
    && eq(mixed[0].support[0], { claimIds: ['blood-type:type:체계적'], sources: ['blood-type'] })
    && eq(mixed[0].support[1], { claimIds: ['saju:dominant-element:감성적'], sources: ['saju'] }), JSON.stringify(mixed));
  check('pair with missing evidence: no fabricated source or shared source',
    mixed.length === 1 && eq(mixed[0].sharedSources, []) && !JSON.stringify(mixed[0]).includes('mbti'));
}

// ── authored-pair rules ──
{
  const t = trace([ev('mbti:type', 'mbti'), ev('saju:dominant-element', 'saju')], [
    cl('mbti:type', '포용적', 'mbtiTraits.coreTags'),
    cl('mbti:type', '체계적', 'mbtiTraits.coreTags'),
    cl('saju:dominant-element', '체계적', 'saju.coreTags'),
  ]);
  const [p] = pairs(deriveAnalysisPatterns(t, [{ tags: ['포용적', '체계적'] }]));
  check('pair: support recorded for both sides',
    !!p && eq(p.support[0].claimIds, ['mbti:type:포용적']) && eq(p.support[1].claimIds, ['mbti:type:체계적', 'saju:dominant-element:체계적']));
  check('pair: same-source co-presence visible via sharedSources', !!p && eq(p.sharedSources, ['mbti']));
}
{
  const t = trace([ev('mbti:type', 'mbti'), ev('blood-type:type', 'blood-type')], [
    cl('mbti:type', '독립적', 'mbtiTraits.coreTags'),
    cl('blood-type:type', '포용적', 'bloodType.coreTags'),
  ]);
  const [p] = pairs(deriveAnalysisPatterns(t, [{ tags: ['독립적', '포용적'] }]));
  check('pair: cross-source co-presence has no shared source', !!p && eq(p.sharedSources, []));
}
{
  // Identity scope: moon / ascendant / tarot claims do not satisfy an authored pair
  const t = trace([ev('western-astrology:moon-sign', 'western-astrology'), ev('tarot:card-number', 'tarot'), ev('mbti:type', 'mbti')], [
    cl('western-astrology:moon-sign', '독립적', 'westernAstrology.moon.data.coreTags'),
    cl('tarot:card-number', '포용적', 'tarot.coreTags'),
    cl('mbti:type', '감성적', 'mbtiTraits.coreTags'),
  ]);
  check('pair: moon / tarot claims are outside Identity scope',
    pairs(deriveAnalysisPatterns(t, [{ tags: ['독립적', '포용적'] }])).length === 0);
}
{
  const t = trace([ev('mbti:type', 'mbti')], [cl('mbti:type', '체계적', 'mbtiTraits.coreTags'), cl('mbti:type', '창의적', 'mbtiTraits.coreTags')]);
  const ps = pairs(deriveAnalysisPatterns(t, [{ tags: ['체계적', '창의적'] }, { tags: ['창의적', '체계적'] }]));
  check('pair: duplicate authored pairs are kept as separate entries (not fixed here)',
    eq(ps.map((p) => p.pairIndex), [0, 1]));
}

// ── real analyses ──
const CASES = [
  ['1990-05-15', '14:30', 'INTJ', 'male', 'A', 0, 37.5665, 126.978, 'solar', false],
  ['1985-12-01', '', 'ENFP', 'female', 'B', 5, undefined, undefined, 'solar', false],
  ['2000-02-29', '06:00', '', 'female', 'O', 10, 35.1796, 129.0756, 'solar', false],
  ['1978-08-15', '22:00', 'ISTP', 'male', 'AB', 15, 33.4996, 126.5312, 'lunar', false],
  ['2020-04-10', '09:30', 'ESFJ', 'female', 'A', 20, 37.5665, 126.978, 'lunar', true],
  ['1992-04-05', '03:15', 'ISFP', 'male', 'A', 3, 37.5665, 126.978, 'solar', false],
  ['1995-07-10', '12:00', 'ISTJ', 'female', 'B', 21, undefined, undefined, 'solar', false],
  ['1988-09-01', '08:00', 'INFJ', 'female', 'O', 7, 37.5665, 126.978, 'solar', false],
] as const;
const analyze = (c: (typeof CASES)[number]): AnalysisSnapshot => analyzeDestiny(
  c[0], c[1], c[2], c[3], c[4], TAROT_DATA[c[5]], c[6], c[7], c[8], c[9]);

const LABEL_TO_TAG: Record<string, CoreTag> = {
  '창의적 사고': '창의적', '분석적 사고': '분석적', '감성적 공감': '감성적', '실용적 실행': '실용적', '뛰어난 사교성': '사교적',
  '강한 독립심': '독립적', '예리한 직관력': '직관적', '체계적 사고': '체계적', '넘치는 열정': '열정적', '따뜻한 포용력': '포용적',
};

let sawSameSourcePair = false, sawCrossSourcePair = false;
for (const c of CASES) {
  const s = analyze(c);
  const p = `[${c[0]} ${c[2] || 'no-mbti'}]`;
  const tr = s.trace!;
  const before = JSON.stringify(tr);
  const snapBefore = JSON.stringify({ ...s, analysisId: '', createdAt: '' });
  const ps1 = deriveAnalysisPatterns(tr, IDENTITY_PAIR_DEFINITIONS);
  const ps2 = deriveAnalysisPatterns(tr, IDENTITY_PAIR_DEFINITIONS);
  check(`${p} deterministic`, eq(ps1, ps2));
  check(`${p} trace not mutated`, JSON.stringify(tr) === before);
  check(`${p} snapshot not mutated, no patterns field`,
    JSON.stringify({ ...s, analysisId: '', createdAt: '' }) === snapBefore && !('patterns' in s));

  const conv = convergence(ps1);
  check(`${p} convergence sources distinct and ≥2, no tarot`,
    conv.every((x) => x.sources.length >= 2 && new Set(x.sources).size === x.sources.length && !x.sources.includes('tarot')));
  // matches the existing intersection: commonKeywords (non-fallback) ⊆ convergence, max support == k
  const kwTags = s.commonKeywords.map((k) => LABEL_TO_TAG[k]);
  const maxSupport = Math.max(0, ...conv.map((x) => x.sources.length));
  if (conv.length > 0) {
    check(`${p} intersection keywords are exactly the max-support convergence traits`,
      eq([...kwTags].sort(), conv.filter((x) => x.sources.length === maxSupport).map((x) => x.trait).sort()),
      `kw ${JSON.stringify(kwTags)} vs conv ${JSON.stringify(conv.map((x) => [x.trait, x.sources.length]))}`);
  }

  const pp = pairs(ps1);
  check(`${p} every pair side has claims whose trait matches`,
    pp.every((x) => x.support.every((side, i) => side.claimIds.length > 0
      && side.claimIds.every((id) => tr.claims.find((cl) => cl.id === id)?.trait === x.traits[i]))));
  // engine v1 invariant: the first authored-pair is what v1 selected (engine v2 ranks candidates instead;
  // see scripts/regression-identity-selection.ts)
  const first = pp[0];
  const expected = first ? IDENTITY_PAIR_DEFINITIONS[first.pairIndex].archetype : undefined;
  const v1 = identityV1(s).archetype;
  if (expected) check(`${p} first authored-pair matches v1 archetype`, expected === v1, `${expected} vs ${v1}`);
  for (const x of pp) {
    if (x.sharedSources.length) sawSameSourcePair = true;
    else sawCrossSourcePair = true;
  }
}
check('real data contains both same-source and cross-source authored pairs', sawSameSourcePair && sawCrossSourcePair);

if (failures) {
  console.log(`\nFAIL: ${failures} pattern check(s) failed`);
  process.exit(1);
}
console.log('\nPASS: all analysis-pattern regression checks');
