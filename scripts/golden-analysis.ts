// One-off golden test for analyzeDestiny().
//
//   npx -y tsx scripts/golden-analysis.ts --capture   # write baseline
//   npx -y tsx scripts/golden-analysis.ts             # compare against baseline
//
// The baseline records the analysis exactly as the UI consumed it before the
// AnalysisSnapshot refactor: the AnalysisOutput fields, plus conflicts,
// keyword strengths, merged core tags and destiny code that page.tsx used to
// assemble itself. Do not regenerate the baseline to make a diff go away.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeDestiny, TAROT_DATA, type AnalysisOutput } from '../app/lib/analysis';
import { detectConflicts } from '../app/lib/conflictEngine';
import { computeKeywordStrengths } from '../app/lib/keywordEngine';
import { generateDestinyCode } from '../app/lib/destinyCode';

const BASELINE_PATH = join(__dirname, 'golden-baseline.json');

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

function analyze(c: GoldenCase) {
  return analyzeDestiny(
    c.birthdate, c.birthtime, c.mbti, c.gender, c.bloodtype,
    TAROT_DATA[c.cardIndex % TAROT_DATA.length],
    c.lat, c.lon, c.calendarType, c.isLeapMonth,
  );
}

function outputFields(r: AnalysisOutput) {
  const {
    saju, zodiac, westernAstrology, mbtiTraits, bloodType, tarot,
    commonKeywords, detailedReading, identityStatement, archetype, tarotFlow,
  } = r;
  return {
    saju, zodiac, westernAstrology, mbtiTraits, bloodType, tarot,
    commonKeywords, detailedReading, identityStatement, archetype, tarotFlow,
  };
}

// Baseline: reproduces the assembly page.tsx performed before the refactor
// (handleCardPicked), using only AnalysisOutput and the standalone engines.
function legacyPageAssembly(c: GoldenCase) {
  const r: AnalysisOutput = analyze(c);
  const wa = r.westernAstrology;
  return {
    output: outputFields(r),
    conflicts: detectConflicts(r.saju, r.zodiac, r.mbtiTraits, r.bloodType, r.westernAstrology),
    keywordStrengths: computeKeywordStrengths(r.saju, r.zodiac, r.mbtiTraits, r.bloodType, r.westernAstrology),
    coreTags: [...new Set([
      ...r.saju.coreTags,
      ...wa.coreTags,
      ...(r.mbtiTraits.type ? r.mbtiTraits.coreTags : []),
      ...r.bloodType.coreTags,
    ])],
    destinyCode: generateDestinyCode(r),
  };
}

// Compare: reads the same information from the AnalysisSnapshot itself.
function fromSnapshot(c: GoldenCase) {
  const s = analyze(c);
  return {
    output: outputFields(s),
    conflicts: s.conflicts,
    keywordStrengths: s.keywordStrengths,
    coreTags: s.coreTags,
    destinyCode: generateDestinyCode(s),
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

const capture = process.argv.includes('--capture');
const build = capture ? legacyPageAssembly : fromSnapshot;
// JSON round-trip so undefined fields compare the same way they were stored.
const actual = JSON.parse(JSON.stringify(CASES.map((c) => ({ name: c.name, result: build(c) }))));

if (capture) {
  writeFileSync(BASELINE_PATH, JSON.stringify(actual, null, 2) + '\n');
  console.log(`Captured ${actual.length} golden cases -> ${BASELINE_PATH}`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const diffs: Diff[] = [];
diff(baseline, actual, 'cases', diffs);

if (diffs.length === 0) {
  console.log(`PASS: ${actual.length} golden cases match baseline`);
} else {
  console.log(`FAIL: ${diffs.length} difference(s)`);
  for (const d of diffs.slice(0, 50)) {
    console.log(`- ${d.path}\n    expected: ${JSON.stringify(d.expected)}\n    actual:   ${JSON.stringify(d.actual)}`);
  }
  process.exit(1);
}
