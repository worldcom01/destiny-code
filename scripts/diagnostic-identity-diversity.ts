// Identity diversity characterization baseline (Phase 2B foundation).
//
//   npx -y tsx scripts/diagnostic-identity-diversity.ts
//
// PURPOSE: record how the CURRENT Identity selection distributes over a fixed,
// deterministic set of synthetic inputs, so future (approved) Identity changes can
// be compared against it.
//
// NOT A POPULATION ESTIMATE: inputs are generated evenly (uniform dates, MBTI,
// blood types, ...). The percentages describe structural bias of the rules, not
// what real users receive.
//
// NOT A QUALITY THRESHOLD: this script never fails because diversity is poor.
// It exits non-zero only for integrity problems: analysis throwing,
// nondeterministic output, or malformed Identity definitions.

import {
  analyzeDestiny, TAROT_DATA, IDENTITY_PAIR_DEFINITIONS, IDENTITY_SINGLE_DEFINITIONS,
  type AnalysisSnapshot, type CoreTag,
} from '../app/lib/analysis';

const N = 20000;
const SEED = 12345;
const FALLBACK_ARCHETYPE = '복합적 패턴의 소유자';
const VOCAB: CoreTag[] = ['창의적', '분석적', '감성적', '실용적', '사교적', '독립적', '직관적', '체계적', '열정적', '포용적'];
const LABEL_TO_TAG: Record<string, CoreTag> = {
  '창의적 사고': '창의적', '분석적 사고': '분석적', '감성적 공감': '감성적', '실용적 실행': '실용적', '뛰어난 사교성': '사교적',
  '강한 독립심': '독립적', '예리한 직관력': '직관적', '체계적 사고': '체계적', '넘치는 열정': '열정적', '따뜻한 포용력': '포용적',
};
const MBTI = ['INFJ', 'INFP', 'ENFJ', 'ENFP', 'INTJ', 'INTP', 'ENTJ', 'ENTP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const PLACES: Array<[number, number] | undefined> = [[37.5665, 126.978], [35.1796, 129.0756], [33.4996, 126.5312], undefined];

let integrityErrors = 0;
function integrity(ok: boolean, msg: string) {
  if (!ok) { integrityErrors++; console.log(`INTEGRITY ERROR: ${msg}`); }
}

// ── deterministic input generation (LCG, no Math.random) ──
function* inputs(seed: number, n: number) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  for (let i = 0; i < n; i++) {
    const y = 1950 + Math.floor(rnd() * 60), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
    const hasTime = rnd() < 0.7;
    const time = hasTime ? `${String(Math.floor(rnd() * 24)).padStart(2, '0')}:${rnd() < 0.5 ? '00' : '30'}` : '';
    const place = hasTime ? pick(PLACES) : undefined;
    yield {
      birthdate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      time,
      mbti: rnd() < 0.85 ? pick(MBTI) : '',
      gender: rnd() < 0.5 ? 'male' : 'female',
      blood: pick(['A', 'B', 'O', 'AB']),
      card: TAROT_DATA[Math.floor(rnd() * TAROT_DATA.length)],
      lat: place?.[0], lon: place?.[1],
      calendar: (rnd() < 0.15 ? 'lunar' : 'solar') as 'solar' | 'lunar',
    };
  }
}

// ── Identity definition structure ──
const pairs = IDENTITY_PAIR_DEFINITIONS;
pairs.forEach(({ tags: [a, b], archetype }, i) => {
  integrity(VOCAB.includes(a) && VOCAB.includes(b), `pair #${i} uses a tag outside the CoreTag vocabulary`);
  integrity(a !== b, `pair #${i} repeats the same tag`);
  integrity(archetype.trim().length > 0, `pair #${i} has an empty archetype`);
});
const setKey = (t: readonly CoreTag[]) => [...t].sort().join('+');
const duplicatePairs = pairs
  .map((p, i) => ({ i, p, first: pairs.findIndex((q) => setKey(q.tags) === setKey(p.tags)) }))
  .filter((x) => x.first !== x.i);
// A pair whose tag set equals an earlier pair's can never be selected (first match wins).
const unreachable = duplicatePairs.map((x) => x.p.archetype);

const singles = Object.entries(IDENTITY_SINGLE_DEFINITIONS) as Array<[CoreTag, { archetype: string }]>;
const allArchetypeList = [...pairs.map((p) => p.archetype), ...singles.map(([, v]) => v.archetype), FALLBACK_ARCHETYPE];
const allArchetypes = [...new Set(allArchetypeList)];
// archetype names identify the selection path below, so they must be unique
integrity(allArchetypes.length === allArchetypeList.length, 'archetype names are not unique across Identity definitions');

// ── run ──
function run(): { counts: Map<string, number>; containsKw: number; pairPath: number; digest: string } {
  const counts = new Map<string, number>(allArchetypes.map((a) => [a, 0]));
  let containsKw = 0, pairPath = 0, h = 5381;
  for (const x of inputs(SEED, N)) {
    let s: AnalysisSnapshot;
    try {
      s = analyzeDestiny(x.birthdate, x.time, x.mbti, x.gender, x.blood, x.card, x.lat, x.lon, x.calendar, false);
    } catch (e) {
      integrity(false, `analyzeDestiny threw for ${JSON.stringify(x)}: ${(e as Error).message}`);
      continue;
    }
    integrity(counts.has(s.archetype), `unknown archetype produced: ${s.archetype}`);
    counts.set(s.archetype, (counts.get(s.archetype) ?? 0) + 1);
    const pairIdx = pairs.findIndex((p) => p.archetype === s.archetype);
    if (pairIdx >= 0) {
      pairPath++;
      const kw = LABEL_TO_TAG[s.commonKeywords[0]];
      if (pairs[pairIdx].tags.includes(kw)) containsKw++;
    }
    for (const ch of `${s.archetype}|${s.commonKeywords.join(',')}\n`) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  }
  return { counts, containsKw, pairPath, digest: (h >>> 0).toString(16) };
}

const first = run();
const second = run();
integrity(first.digest === second.digest, `nondeterministic output: digest ${first.digest} vs ${second.digest}`);

// ── report ──
const pct = (n: number, d = N) => `${((n / d) * 100).toFixed(1)}%`;
const sorted = [...first.counts.entries()].sort((a, b) => b[1] - a[1]);
const observed = sorted.filter(([, v]) => v > 0);
const top4 = sorted.slice(0, 4).reduce((sum, [, v]) => sum + v, 0);

console.log(`Identity diversity baseline — synthetic, evenly generated inputs (NOT a population estimate)`);
console.log(`cases: ${N}   seed: ${SEED}   result digest: ${first.digest}`);
console.log(`defined archetypes: ${allArchetypes.length}   observed: ${observed.length}`);
console.log(`top Identity share: ${pct(sorted[0][1])} (${sorted[0][0]})`);
console.log(`top 4 Identity share: ${pct(top4)}`);
console.log(`selected via authored pair: ${pct(first.pairPath)}   via single/fallback: ${pct(N - first.pairPath)}`);
console.log(`selected pair contains representative intersection keyword (commonKeywords[0]): ${pct(first.containsKw, first.pairPath)} of pair selections`);
console.log(`selected pair does NOT contain it: ${pct(first.pairPath - first.containsKw, first.pairPath)} of pair selections`);
console.log(`duplicate authored pairs: ${duplicatePairs.length ? duplicatePairs.map((x) => `#${x.i} duplicates #${x.first} (${x.p.tags.join('+')})`).join('; ') : 'none'}`);
console.log(`structurally unreachable archetypes: ${unreachable.length ? unreachable.join(', ') : 'none'}`);
console.log(`\narchetype distribution:`);
for (const [a, v] of sorted) console.log(`  ${pct(v).padStart(6)}  ${String(v).padStart(5)}  ${a}${v === 0 ? '   (not observed in this sample)' : ''}`);

if (integrityErrors) {
  console.log(`\nFAIL: ${integrityErrors} integrity error(s)`);
  process.exit(1);
}
console.log(`\nOK: diversity baseline recorded (characterization only, no quality threshold)`);
