// Golden test for analyzeDestiny() across the engine v1 → v2 Identity migration.
//
//   npx -y tsx scripts/golden-analysis.ts                # compare (v1 allowed-diff + exact v2)
//   npx -y tsx scripts/golden-analysis.ts --capture-v2   # write the v2 baseline (refused if the v1 check fails)
//
// golden-baseline.v1.json is the engine v1 baseline, byte-identical to the file
// captured before the AnalysisSnapshot refactor. It is never rewritten. Against it,
// only the approved Identity Selection v2 impact may differ:
//   output.identityStatement, output.archetype, destinyCode (seeded by archetype)
// Everything else (CoreTags, commonKeywords, Saju, narrative, conflicts, keyword
// strengths, Tarot, ...) must stay identical.
//
// golden-baseline.v2.json is the engine v2 baseline (exact match, including the
// identitySelection reason). Do not regenerate either baseline to make a diff go away.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeDestiny, identityV1, TAROT_DATA, type AnalysisSnapshot } from '../app/lib/analysis';
import { generateDestinyCode } from '../app/lib/destinyCode';

const V1_PATH = join(__dirname, 'golden-baseline.v1.json');
const V2_PATH = join(__dirname, 'golden-baseline.v2.json');
const ALLOWED_V1_DIFFS = new Set(['result.output.identityStatement', 'result.output.archetype', 'result.destinyCode']);

interface GoldenCase {
  name: string;
  birthdate: string;
  birthtime: string;
  mbti: string;
  gender: string;
  bloodtype: string;
  cardIndex: number;
  lat?: number;
  lon?: number;
  calendarType: 'solar' | 'lunar';
  isLeapMonth: boolean;
}

const CASES: GoldenCase[] = [
  { name: 'solar, full input, Seoul',          birthdate: '1990-05-15', birthtime: '14:30', mbti: 'INTJ', gender: 'male',   bloodtype: 'A',  cardIndex: 0,  lat: 37.5665, lon: 126.978, calendarType: 'solar', isLeapMonth: false },
  { name: 'solar, no time, no place',          birthdate: '1985-12-01', birthtime: '',      mbti: 'ENFP', gender: 'female', bloodtype: 'B',  cardIndex: 5,  calendarType: 'solar', isLeapMonth: false },
  { name: 'solar, no MBTI',                    birthdate: '2000-02-29', birthtime: '06:00', mbti: '',     gender: 'female', bloodtype: 'O',  cardIndex: 10, lat: 35.1796, lon: 129.0756, calendarType: 'solar', isLeapMonth: false },
  { name: 'lunar, regular month',              birthdate: '1978-08-15', birthtime: '22:00', mbti: 'ISTP', gender: 'male',   bloodtype: 'AB', cardIndex: 15, lat: 33.4996, lon: 126.5312, calendarType: 'lunar', isLeapMonth: false },
  { name: 'lunar, leap month',                 birthdate: '2020-04-10', birthtime: '09:30', mbti: 'ESFJ', gender: 'female', bloodtype: 'A',  cardIndex: 20, lat: 37.5665, lon: 126.978, calendarType: 'lunar', isLeapMonth: true },
  { name: 'ISFP + fire sign + A (conflicts)', birthdate: '1992-04-05', birthtime: '03:15', mbti: 'ISFP', gender: 'male',   bloodtype: 'A',  cardIndex: 3,  lat: 37.5665, lon: 126.978, calendarType: 'solar', isLeapMonth: false },
  { name: 'water sign, thinking, B + SJ',      birthdate: '1995-07-10', birthtime: '12:00', mbti: 'ISTJ', gender: 'female', bloodtype: 'B',  cardIndex: 21, calendarType: 'solar', isLeapMonth: false },
];

function analyze(c: GoldenCase): AnalysisSnapshot {
  return analyzeDestiny(
    c.birthdate, c.birthtime, c.mbti, c.gender, c.bloodtype,
    TAROT_DATA[c.cardIndex % TAROT_DATA.length],
    c.lat, c.lon, c.calendarType, c.isLeapMonth,
  );
}

// Everything the UI reads, taken from the snapshot (same shape as the v1 baseline),
// plus the engine version and selection reason for v2.
function fromSnapshot(s: AnalysisSnapshot) {
  const {
    saju, zodiac, westernAstrology, mbtiTraits, bloodType, tarot,
    commonKeywords, detailedReading, identityStatement, archetype, tarotFlow,
    conflicts, keywordStrengths, coreTags, engineVersion, identitySelection,
  } = s;
  return {
    output: {
      saju, zodiac, westernAstrology, mbtiTraits, bloodType, tarot,
      commonKeywords, detailedReading, identityStatement, archetype, tarotFlow,
    },
    conflicts,
    keywordStrengths,
    coreTags,
    destinyCode: generateDestinyCode(s),
    engineVersion,
    identitySelection,
  };
}

type Diff = { path: string; expected: unknown; actual: unknown };

function diff(expected: unknown, actual: unknown, path: string, out: Diff[]) {
  if (typeof expected !== typeof actual || Array.isArray(expected) !== Array.isArray(actual)
      || expected === null || actual === null || typeof expected !== 'object') {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) out.push({ path, expected, actual });
    return;
  }
  const e = expected as Record<string, unknown>;
  const a = actual as Record<string, unknown>;
  for (const k of new Set([...Object.keys(e), ...Object.keys(a)])) {
    diff(e[k], a[k], `${path}.${k}`, out);
  }
}

const printDiffs = (ds: Diff[]) => {
  for (const d of ds.slice(0, 50)) {
    console.log(`- ${d.path}\n    expected: ${JSON.stringify(d.expected)}\n    actual:   ${JSON.stringify(d.actual)}`);
  }
};

// JSON round-trip so undefined fields compare the same way they were stored.
const actual = JSON.parse(JSON.stringify(CASES.map((c) => {
  const s = analyze(c);
  return { name: c.name, result: fromSnapshot(s), v1Archetype: identityV1(s).archetype };
})));

let failed = false;

// ── 1. engine v1 baseline: only the approved Identity impact may differ ──
const v1 = JSON.parse(readFileSync(V1_PATH, 'utf8')) as Array<{ name: string; result: Record<string, unknown> }>;
const unexpected: Diff[] = [];
let identityChanged = 0;
console.log('engine v1 → v2 golden comparison:');
v1.forEach((base, i) => {
  const now = actual[i];
  const ds: Diff[] = [];
  // keys that exist only in v2 (engineVersion, identitySelection) are new, not changes
  const comparable: Record<string, unknown> = { ...now.result };
  delete comparable.engineVersion;
  delete comparable.identitySelection;
  diff(base.result, comparable, 'result', ds);
  unexpected.push(...ds.filter((d) => !ALLOWED_V1_DIFFS.has(d.path)).map((d) => ({ ...d, path: `[${base.name}] ${d.path}` })));
  const v1Arch = (base.result.output as { archetype: string }).archetype;
  const v2Arch = now.result.output.archetype;
  // the retained v1 selector still reproduces the historical v1 Identity
  if (now.v1Archetype !== v1Arch) {
    unexpected.push({ path: `[${base.name}] identityV1()`, expected: v1Arch, actual: now.v1Archetype });
  }
  if (v1Arch !== v2Arch) identityChanged++;
  const r = now.result.identitySelection;
  console.log(`  ${v1Arch === v2Arch ? '=' : '≠'} [${base.name}] ${v1Arch} → ${v2Arch}`
    + `   (${r.decision}${r.representativeTrait ? `, 대표 ${r.representativeTrait}` : ''}${r.usedAuthoredOrder ? ', authored order' : ''})`);
});
console.log(`  Identity changed in ${identityChanged} of ${v1.length} cases`);
if (unexpected.length) {
  failed = true;
  console.log(`FAIL: ${unexpected.length} change(s) outside the approved Identity impact`);
  printDiffs(unexpected);
} else {
  console.log('PASS: v1 baseline differs only in identityStatement / archetype / destinyCode');
}

// ── 2. engine v2 baseline: exact ──
const v2Actual = actual.map((a: { name: string; result: unknown }) => ({ name: a.name, result: a.result }));
if (process.argv.includes('--capture-v2')) {
  if (failed) {
    console.log('REFUSED: not writing the v2 baseline while the v1 comparison has unexpected changes');
    process.exit(1);
  }
  writeFileSync(V2_PATH, JSON.stringify(v2Actual, null, 2) + '\n');
  console.log(`Captured ${v2Actual.length} v2 golden cases -> ${V2_PATH}`);
  process.exit(0);
}

const v2Diffs: Diff[] = [];
diff(JSON.parse(readFileSync(V2_PATH, 'utf8')), v2Actual, 'cases', v2Diffs);
if (v2Diffs.length) {
  failed = true;
  console.log(`FAIL: ${v2Diffs.length} difference(s) from the v2 baseline`);
  printDiffs(v2Diffs);
} else {
  console.log(`PASS: ${v2Actual.length} golden cases match v2 baseline`);
}

if (failed) process.exit(1);
console.log(`PASS: golden v1→v2 migration checks (${v2Actual.length} cases)`);
