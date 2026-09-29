// Identity diversity characterization baseline (Phase 2B foundation).
//
//   npx -y tsx scripts/diagnostic-identity-diversity.ts
//
// PURPOSE: record how the CURRENT Identity selection distributes over a fixed,
// deterministic set of synthetic inputs, so future (approved) Identity changes can
// be compared against it. This is a structural characterization of the engine.
//
// NOT A POPULATION ESTIMATE: inputs are sampled uniformly from the input space the
// UI offers. The percentages describe structural bias of the rules, not what real
// users receive.
//
// NOT A QUALITY THRESHOLD: this script never fails because diversity is poor.
// It exits non-zero only for integrity problems: analysis throwing,
// nondeterministic output, malformed Identity definitions, a degenerate input
// stream (short repeats), or an input field assumed irrelevant turning out to
// affect the measured outputs.
//
// EFFECTIVE INPUT (what makes two rows the same case for this diagnostic):
//   solar birthdate, birth time, birthplace coordinates (only when a time is
//   given — without a time the ascendant is not computed), MBTI, blood type.
// Held constant because they do not affect the measured outputs (archetype,
// commonKeywords), checked below on a subsample:
//   gender   — does not change any analysis output at all
//   tarot    — changes narrative text, not Identity or the intersection
// Lunar input is not sampled separately: analyzeDestiny converts it to the same
// solar date space, so it would only duplicate solar cases.

import {
  analyzeDestiny, TAROT_DATA, IDENTITY_PAIR_DEFINITIONS, IDENTITY_SINGLE_DEFINITIONS,
  type AnalysisSnapshot, type CoreTag,
} from '../app/lib/analysis';
import { LOCATION_OPTION_GROUPS } from '../app/lib/regions';

const N = 20000;
const SEED = 12345;
const FALLBACK_ARCHETYPE = '복합적 패턴의 소유자';
const VOCAB: CoreTag[] = ['창의적', '분석적', '감성적', '실용적', '사교적', '독립적', '직관적', '체계적', '열정적', '포용적'];
const LABEL_TO_TAG: Record<string, CoreTag> = {
  '창의적 사고': '창의적', '분석적 사고': '분석적', '감성적 공감': '감성적', '실용적 실행': '실용적', '뛰어난 사교성': '사교적',
  '강한 독립심': '독립적', '예리한 직관력': '직관적', '체계적 사고': '체계적', '넘치는 열정': '열정적', '따뜻한 포용력': '포용적',
};
const MBTI = ['INFJ', 'INFP', 'ENFJ', 'ENFP', 'INTJ', 'INTP', 'ENTJ', 'ENTP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const BLOOD = ['A', 'B', 'O', 'AB'];
// The birth-time values the UI can send (page.tsx SIJU_TIME_MAP)
const SIJU_TIMES = ['00:30', '02:30', '04:30', '06:30', '08:30', '10:30', '12:30', '14:30', '16:30', '18:30', '20:30', '22:30'];
// Distinct coordinates of the UI birthplace options
const PLACES: Array<[number, number]> = [...new Map(
  LOCATION_OPTION_GROUPS.flatMap((g) => g.options).map((o) => [`${o.lat},${o.lon}`, [o.lat, o.lon] as [number, number]]),
).values()];
const DATE_START = Date.UTC(1950, 0, 1);
const DAY_COUNT = Math.round((Date.UTC(2010, 0, 1) - DATE_START) / 86400000); // 1950-01-01 .. 2009-12-31
const FIXED_GENDER = 'male';
const FIXED_CARD = TAROT_DATA[0];
// A healthy stream over this space (~10^9 effective inputs) has essentially no repeats.
// The previous LCG repeated 92.955% of rows; anything above this bound means a degenerate stream.
const MAX_DUPLICATE_RATE = 0.01;

let integrityErrors = 0;
function integrity(ok: boolean, msg: string) {
  if (!ok) { integrityErrors++; console.log(`INTEGRITY ERROR: ${msg}`); }
}

// ── deterministic input generation (mulberry32: 32-bit integer arithmetic, period 2^32, no Math.random) ──
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1)
  };
}

interface EffectiveInput {
  birthdate: string;
  time: string;
  place: [number, number] | undefined;
  mbti: string;
  blood: string;
}

function* inputs(seed: number, n: number): Generator<EffectiveInput> {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    integrity(r >= 0 && r < 1, `generator produced ${r} outside [0, 1)`);
    const date = new Date(DATE_START + Math.floor(r * DAY_COUNT) * 86400000);
    const time = rnd() < 0.7 ? pick(SIJU_TIMES) : '';
    const place = time && rnd() < 0.85 ? pick(PLACES) : undefined;
    yield {
      birthdate: date.toISOString().slice(0, 10),
      time,
      place,
      mbti: rnd() < 0.85 ? pick(MBTI) : '',
      blood: pick(BLOOD),
    };
  }
}

const effectiveKey = (x: EffectiveInput) =>
  [x.birthdate, x.time || '-', x.time && x.place ? x.place.join(',') : '-', x.mbti || '-', x.blood].join('|');

const analyze = (x: EffectiveInput, gender = FIXED_GENDER, card = FIXED_CARD): AnalysisSnapshot =>
  analyzeDestiny(x.birthdate, x.time, x.mbti, gender, x.blood, card, x.place?.[0], x.place?.[1], 'solar', false);

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
interface RunResult {
  rows: number; unique: number;
  counts: Map<string, number>; containsKw: number; pairPath: number; digest: string;
}

function run(): RunResult {
  const counts = new Map<string, number>(allArchetypes.map((a) => [a, 0]));
  const seen = new Set<string>();
  let rows = 0, containsKw = 0, pairPath = 0, h = 5381;
  for (const x of inputs(SEED, N)) {
    rows++;
    seen.add(effectiveKey(x));
    let s: AnalysisSnapshot;
    try {
      s = analyze(x);
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
    for (const ch of `${effectiveKey(x)}=${s.archetype}|${s.commonKeywords.join(',')}\n`) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  }
  return { rows, unique: seen.size, counts, containsKw, pairPath, digest: (h >>> 0).toString(16) };
}

const first = run();
const second = run();
integrity(first.digest === second.digest, `nondeterministic output: digest ${first.digest} vs ${second.digest}`);
const duplicates = first.rows - first.unique;
integrity(duplicates / first.rows <= MAX_DUPLICATE_RATE,
  `degenerate input stream: ${duplicates} of ${first.rows} rows repeat an earlier effective input`);

// The fields held constant must not affect the measured outputs.
{
  let i = 0;
  for (const x of inputs(SEED, 300)) {
    const base = analyze(x);
    const alt = analyze(x, 'female', TAROT_DATA[(i++ * 7 + 13) % TAROT_DATA.length]);
    integrity(base.archetype === alt.archetype && base.commonKeywords.join() === alt.commonKeywords.join(),
      `gender / tarot changed Identity or intersection for ${effectiveKey(x)} — effective input definition is stale`);
  }
}

// ── report ──
const pct = (n: number, d = first.rows) => `${((n / d) * 100).toFixed(1)}%`;
const sorted = [...first.counts.entries()].sort((a, b) => b[1] - a[1]);
const observed = sorted.filter(([, v]) => v > 0);
const top4 = sorted.slice(0, 4).reduce((sum, [, v]) => sum + v, 0);

console.log(`Identity diversity baseline — structural characterization of the engine`);
console.log(`population: synthetic, uniformly sampled UI input space (NOT a real-user population estimate)`);
console.log(`  solar dates 1950-01-01..2009-12-31, time: 70% one of 12 시진 / 30% none,`);
console.log(`  place: 85% of timed rows one of ${PLACES.length} UI coordinates, MBTI: 85% one of 16 / 15% none, blood: uniform`);
console.log(`  held constant (verified not to affect Identity/intersection): gender=${FIXED_GENDER}, tarot=${FIXED_CARD.nameEn}`);
console.log(`generator: mulberry32, seed ${SEED}`);
console.log(`generated rows: ${first.rows}   unique effective inputs: ${first.unique}   duplicates: ${duplicates}   uniqueness: ${((first.unique / first.rows) * 100).toFixed(2)}%`);
console.log(`result digest: ${first.digest}`);
console.log(`defined archetypes: ${allArchetypes.length}   observed: ${observed.length}`);
console.log(`top Identity share: ${pct(sorted[0][1])} (${sorted[0][0]})`);
console.log(`top 4 Identity share: ${pct(top4)}`);
console.log(`selected via authored pair: ${pct(first.pairPath)}   via single/fallback: ${pct(first.rows - first.pairPath)}`);
console.log(`selected pair contains representative intersection keyword (commonKeywords[0]): ${pct(first.containsKw, first.pairPath)} of pair selections`);
console.log(`selected pair does NOT contain it: ${pct(first.pairPath - first.containsKw, first.pairPath)} of pair selections`);
console.log(`duplicate authored pairs: ${duplicatePairs.length ? duplicatePairs.map((x) => `#${x.i} duplicates #${x.first} (${x.p.tags.join('+')})`).join('; ') : 'none'}`);
console.log(`structurally unreachable archetypes: ${unreachable.length ? unreachable.join(', ') : 'none'}`);
console.log(`\narchetype distribution:`);
for (const [a, v] of sorted) {
  const note = v > 0 ? '' : unreachable.includes(a) ? '   (structurally unreachable)' : '   (not observed in this sample)';
  console.log(`  ${pct(v).padStart(6)}  ${String(v).padStart(5)}  ${a}${note}`);
}

if (integrityErrors) {
  console.log(`\nFAIL: ${integrityErrors} integrity error(s)`);
  process.exit(1);
}
console.log(`\nOK: diversity baseline recorded (characterization only, no quality threshold)`);
