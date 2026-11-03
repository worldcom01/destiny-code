// Intersection quality & diversity diagnostic (Phase 2).
//   npx -y tsx scripts/diagnostic-intersection-quality.ts [N]
// Synthetic, deterministic inputs only — no real user data, no network, no OpenAI.
// Measures structural diversity of the engine; never fails on "poor" numbers.

import { analyzeDestiny, TAROT_DATA, type AnalysisSnapshot, type CoreTag } from '../app/lib/analysis';
import { parsePalmReading, PALM_AREA_KEYS, PALM_TRAIT_VOCAB, type PalmReading } from '../app/lib/palmReading';
import { LOCATION_OPTION_GROUPS } from '../app/lib/regions';

const N = Number(process.argv[2] ?? 1500);
const VOCAB = PALM_TRAIT_VOCAB as readonly CoreTag[];
const SIJU = ['00:30', '02:30', '04:30', '06:30', '08:30', '10:30', '12:30', '14:30', '16:30', '18:30', '20:30', '22:30'];
const MBTI = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const PLACES = LOCATION_OPTION_GROUPS.flatMap((g) => g.options);

let seed = 20261103;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

type Input = { birthdate: string; time: string; mbti: string; blood: string; place?: { lat: number; lon: number }; card: number };
const inputs: Input[] = Array.from({ length: N }, () => {
  const y = 1955 + Math.floor(rnd() * 55), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
  const time = rnd() < 0.7 ? pick(SIJU) : '';
  return {
    birthdate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    time, mbti: rnd() < 0.85 ? pick(MBTI) : '', blood: pick(['A', 'B', 'O', 'AB']),
    place: time ? pick(PLACES) : undefined, card: Math.floor(rnd() * TAROT_DATA.length),
  };
});

// synthetic palm readings: random observed areas, confidence, 0–2 candidate traits
function randomPalm(confidence?: 'high' | 'medium' | 'low'): PalmReading {
  const areas = Object.fromEntries(PALM_AREA_KEYS.map((k) => [k, rnd() < 0.15
    ? { status: 'unreadable', limitations: [] }
    : {
        status: 'observed', observedFeatures: ['합성 관찰'], interpretation: '합성 해석', limitations: [],
        confidence: confidence ?? pick(['high', 'medium', 'low'] as const),
        traitCandidates: [...new Set([pick(VOCAB), pick(VOCAB)])].slice(0, Math.floor(rnd() * 3)),
      }]));
  return parsePalmReading({ version: 2, quality: { usability: 'usable', summary: '' }, areas, extraction: { adapterVersion: 'a', modelRevision: 'm', promptVersion: 'p' } });
}

const run = (x: Input, palm?: PalmReading): AnalysisSnapshot =>
  analyzeDestiny(x.birthdate, x.time, x.mbti, 'female', x.blood, TAROT_DATA[x.card], x.place?.lat, x.place?.lon, 'solar', false, palm);

const count = (xs: string[]) => { const m = new Map<string, number>(); xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)); return m; };
const effective = (m: Map<string, number>) => { const n = [...m.values()].reduce((a, b) => a + b, 0); return Math.exp(-[...m.values()].reduce((h, c) => h + (c / n) * Math.log(c / n), 0)); };
const top = (m: Map<string, number>, k: number, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([v, c]) => `${v} ${(100 * c / n).toFixed(1)}%`).join(', ');
const collision = (m: Map<string, number>, n: number) => [...m.values()].reduce((s, c) => s + c * (c - 1), 0) / (n * (n - 1));
const pct = (a: number, b: number) => `${(100 * a / b).toFixed(1)}%`;

function report(label: string, rs: AnalysisSnapshot[]) {
  const n = rs.length;
  const arch = count(rs.map((r) => r.archetype));
  const key1 = count(rs.map((r) => r.commonKeywords[0] ?? '-'));
  const kwSet = count(rs.map((r) => [...r.commonKeywords].sort().join('+')));
  const top3 = count(rs.map((r) => (r.intersection?.common ?? []).slice(0, 3).map((p) => p.trait).join('+') || '-'));
  const full = count(rs.map((r) => `${r.archetype}|${[...r.commonKeywords].sort().join('+')}|${r.identityStatement}`));
  const tagFreq = new Map<string, number>();
  rs.forEach((r) => new Set(r.coreTags).forEach((t) => tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1)));
  const kwTag = new Map<string, number>();
  rs.forEach((r) => r.commonKeywords.forEach((k) => kwTag.set(k, (kwTag.get(k) ?? 0) + 1)));
  const generic = rs.filter((r) => r.identitySelection?.decision === 'generic').length;
  const decisions = count(rs.map((r) => r.identitySelection?.decision ?? '-'));
  const kwLen = count(rs.map((r) => String(r.commonKeywords.length)));
  console.log(`\n== ${label} (n=${n})`);
  console.log(`archetypes: ${arch.size} distinct, effective ${effective(arch).toFixed(1)}; top: ${top(arch, 5, n)}`);
  console.log(`identity decisions: ${top(decisions, 4, n)} | generic ${pct(generic, n)}`);
  console.log(`commonKeywords[0]: effective ${effective(key1).toFixed(1)}; top: ${top(key1, 4, n)}`);
  console.log(`commonKeywords count: ${top(kwLen, 6, n)} | distinct keyword sets ${kwSet.size}`);
  console.log(`top-3 common patterns: ${top3.size} distinct, effective ${effective(top3).toFixed(1)}; most repeated: ${top(top3, 3, n)}`);
  console.log(`pair duplicate rate (same archetype+keywords+statement): ${(100 * collision(full, n)).toFixed(2)}%`);
  console.log(`CoreTag presence in coreTags: ${VOCAB.map((t) => `${t} ${pct(tagFreq.get(t) ?? 0, n)}`).join(' · ')}`);
  console.log(`CoreTag presence in commonKeywords: ${[...kwTag.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t} ${pct(c, n)}`).join(' · ')}`);
}

function sources(rs: AnalysisSnapshot[]) {
  const n = rs.length;
  const inCommon = new Map<string, number>();
  for (const r of rs) for (const p of r.intersection?.common ?? []) for (const s of p.sources) inCommon.set(s.source, (inCommon.get(s.source) ?? 0) + 1);
  console.log(`source participation in common patterns (per result): ${[...inCommon.entries()].map(([s, c]) => `${s} ${(c / n).toFixed(2)}`).join(' · ')}`);
}

const t0 = Date.now();
const base = inputs.map((x) => run(x));
const ms = (Date.now() - t0) / N;
report('no palm', base);
sources(base);

// determinism
const again = inputs.slice(0, 200).map((x) => run(x));
const same = again.every((r, i) => r.archetype === base[i].archetype && r.commonKeywords.join() === base[i].commonKeywords.join() && r.identityStatement === base[i].identityStatement);
console.log(`\ndeterminism (200 re-runs, same tarot card): ${same ? 'identical' : 'DIFFERENT'}`);

// palm effect
const palms = inputs.map(() => randomPalm());
const withPalm = inputs.map((x, i) => run(x, palms[i]));
report('with synthetic palm', withPalm);
sources(withPalm);
const archChanged = withPalm.filter((r, i) => r.archetype !== base[i].archetype).length;
const kwChanged = withPalm.filter((r, i) => r.commonKeywords.join() !== base[i].commonKeywords.join()).length;
console.log(`palm changes archetype in ${pct(archChanged, N)}, commonKeywords in ${pct(kwChanged, N)}`);
const palmInIdentity = withPalm.filter((r) => (r.identitySelection?.support ?? []).some((s) => s.sources.includes('palm'))).length;
console.log(`palm appears in Identity support: ${pct(palmInIdentity, N)}`);

// confidence sensitivity: same candidates, high vs low confidence
const sub = inputs.slice(0, 300);
const hi = sub.map((x) => run(x, randomPalm('high')));
seed = 777; const lo = sub.map((x) => run(x, randomPalm('low')));
console.log(`low-confidence palm leaves result = no-palm: ${pct(lo.filter((r, i) => r.archetype === base[i].archetype && r.commonKeywords.join() === base[i].commonKeywords.join()).length, sub.length)} | high-confidence changes archetype: ${pct(hi.filter((r, i) => r.archetype !== base[i].archetype).length, sub.length)}`);
console.log(`\nspeed: ${ms.toFixed(1)} ms per analyzeDestiny (no palm)`);
