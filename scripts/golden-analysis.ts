// Golden test for analyzeDestiny() across engine versions.
//
//   npx -y tsx scripts/golden-analysis.ts                # compare (v1/v2 allowed-diff, exact v3 view, exact v4)
//   npx -y tsx scripts/golden-analysis.ts --capture-v4   # write the v4 baseline (refused if v1/v2/v3 checks fail)
//
// Engine v4 (Identity Selection v3, keyword order by distinctiveness, identityNarrative): the v1/v2/v3 checks run
// on the "engine v3 view" rebuilt from the same snapshot — raw k-way keyword order, the v2 selector with the
// 11-pair catalog, and the narrative generators fed with that order. That keeps every historical baseline exact.
// v4 vs v3 view may differ only in keyword ORDER (same set), keyword-derived narrative text, Identity fields and
// engineVersion; v4 additions (identityNarrative, intersection) are new keys.
//
// Historical baselines are never rewritten:
//   golden-baseline.v1.json — engine v1 (byte-identical to the pre-AnalysisSnapshot capture)
//   golden-baseline.v2.json — engine v2 (Identity Selection v2)
// Current engine (v3 = v2 selector + 창의적/독립적 catalog pair) against them:
//   v1: only identityStatement / archetype / destinyCode may differ.
//   v2: only identityStatement / archetype / destinyCode / engineVersion and the
//       selection-dependent parts of identitySelection may differ; in addition the
//       production selector run on the current trace with the engine v2 catalog prefix
//       must reproduce the stored v2 selection exactly, and every v2 → v3 Identity change
//       must be a selection of a pair added in v3 (catalog addition is the only cause).
//   v3: exact match, including identitySelection and trace.
// Do not regenerate any baseline to make a diff go away.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  analyzeDestiny, identityV1, TAROT_DATA, IDENTITY_PAIR_DEFINITIONS, IDENTITY_SINGLE_DEFINITIONS, IDENTITY_PAIR_COUNT_BY_ENGINE,
  calcCommonKeywords, __engineInternals,
  type AnalysisSnapshot, type CoreTag,
} from '../app/lib/analysis';
import { selectIdentityV2 } from '../app/lib/identitySelection';
import { generateDestinyCode } from '../app/lib/destinyCode';

const V1_PATH = join(__dirname, 'golden-baseline.v1.json');
const V2_PATH = join(__dirname, 'golden-baseline.v2.json');
const V3_PATH = join(__dirname, 'golden-baseline.v3.json');
const V4_PATH = join(__dirname, 'golden-baseline.v4.json');
const ALLOWED_V1_DIFFS = new Set(['result.output.identityStatement', 'result.output.archetype', 'result.destinyCode']);
const ALLOWED_V2_DIFFS = new Set([...ALLOWED_V1_DIFFS, 'result.engineVersion']);
const ALLOWED_V2_SELECTION_PREFIXES = ['decision', 'pairIndex', 'selectedTraits', 'usedAuthoredOrder', 'support']
  .map((k) => `result.identitySelection.${k}`);
const allowedV2 = (path: string) => ALLOWED_V2_DIFFS.has(path)
  || ALLOWED_V2_SELECTION_PREFIXES.some((pre) => path === pre || path.startsWith(`${pre}.`));
const LABEL_TO_TAG: Record<string, CoreTag> = {
  '창의적 사고': '창의적', '분석적 사고': '분석적', '감성적 공감': '감성적', '실용적 실행': '실용적', '뛰어난 사교성': '사교적',
  '강한 독립심': '독립적', '예리한 직관력': '직관적', '체계적 사고': '체계적', '넘치는 열정': '열정적', '따뜻한 포용력': '포용적',
};

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
    conflicts, keywordStrengths, coreTags, engineVersion, identitySelection, trace,
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
    trace,
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

// engine v3 view of a v4 snapshot (see header)
function v3View(s: AnalysisSnapshot): AnalysisSnapshot {
  const kw = calcCommonKeywords([s.westernAstrology.coreTags, s.mbtiTraits.coreTags, s.saju.coreTags, s.bloodType.coreTags]);
  const sel = selectIdentityV2({
    trace: s.trace!, pairs: IDENTITY_PAIR_DEFINITIONS.slice(0, IDENTITY_PAIR_COUNT_BY_ENGINE['3']),
    hasSingle: (t) => IDENTITY_SINGLE_DEFINITIONS[t] !== undefined,
    keywordTag: LABEL_TO_TAG[kw[0]], sajuFirstTag: s.saju.coreTags[0],
  });
  return {
    ...s, engineVersion: '3', commonKeywords: kw, identitySelection: sel,
    ...__engineInternals.identityFromSelection(sel),
    detailedReading: __engineInternals.generateDetailedReading(s.saju, s.zodiac, s.mbtiTraits, s.bloodType, s.tarot, kw),
    tarotFlow: __engineInternals.generateTarotFlow(s.tarot, kw, s.saju),
  };
}

// JSON round-trip so undefined fields compare the same way they were stored.
const v4Snapshots = CASES.map((c) => analyze(c));
const actual = JSON.parse(JSON.stringify(v4Snapshots.map((s4, i) => {
  const c = CASES[i];
  const s = v3View(s4);
  const v2Selection = selectIdentityV2({
    trace: s.trace!, pairs: IDENTITY_PAIR_DEFINITIONS.slice(0, IDENTITY_PAIR_COUNT_BY_ENGINE['2']),
    hasSingle: (t) => IDENTITY_SINGLE_DEFINITIONS[t] !== undefined,
    keywordTag: LABEL_TO_TAG[s.commonKeywords[0]], sajuFirstTag: s.saju.coreTags[0],
  });
  return { name: c.name, result: fromSnapshot(s), v1Archetype: identityV1(s).archetype, v2Selection };
})));

let failed = false;
const without = (r: Record<string, unknown>, keys: string[]) => {
  const c = { ...r };
  for (const k of keys) delete c[k];
  return c;
};

// ── 1. engine v1 baseline: only the Identity text / archetype / Destiny Code may differ ──
{
  const v1 = JSON.parse(readFileSync(V1_PATH, 'utf8')) as Array<{ name: string; result: Record<string, unknown> }>;
  const unexpected: Diff[] = [];
  let changed = 0;
  v1.forEach((base, i) => {
    const now = actual[i];
    const ds: Diff[] = [];
    // keys that exist only in newer engines are additions, not changes
    diff(base.result, without(now.result, ['engineVersion', 'identitySelection', 'trace']), 'result', ds);
    unexpected.push(...ds.filter((d) => !ALLOWED_V1_DIFFS.has(d.path)).map((d) => ({ ...d, path: `[${base.name}] ${d.path}` })));
    const v1Arch = (base.result.output as { archetype: string }).archetype;
    if (now.v1Archetype !== v1Arch) unexpected.push({ path: `[${base.name}] identityV1()`, expected: v1Arch, actual: now.v1Archetype });
    if (v1Arch !== now.result.output.archetype) changed++;
  });
  console.log(`engine v1 → current: Identity changed in ${changed} of ${v1.length} cases`);
  if (unexpected.length) {
    failed = true;
    console.log(`FAIL: ${unexpected.length} change(s) outside the approved Identity impact (v1)`);
    printDiffs(unexpected);
  } else {
    console.log('PASS: v1 baseline differs only in identityStatement / archetype / destinyCode');
  }
}

// ── 2. engine v2 baseline: strict allowed-change check + v2 reproduction ──
{
  const v2 = JSON.parse(readFileSync(V2_PATH, 'utf8')) as Array<{ name: string; result: Record<string, unknown> }>;
  const unexpected: Diff[] = [];
  let changed = 0;
  console.log('engine v2 → v3 golden comparison:');
  v2.forEach((base, i) => {
    const now = actual[i];
    const ds: Diff[] = [];
    diff(base.result, without(now.result, ['trace']), 'result', ds);
    unexpected.push(...ds.filter((d) => !allowedV2(d.path)).map((d) => ({ ...d, path: `[${base.name}] ${d.path}` })));
    // the unchanged selector on the current trace with the v2 catalog reproduces the stored v2 selection
    const repro: Diff[] = [];
    diff(base.result.identitySelection, now.v2Selection, `[${base.name}] v2 selection reproduced`, repro);
    unexpected.push(...repro);
    const v2Arch = (base.result.output as { archetype: string }).archetype;
    const v3Arch = now.result.output.archetype;
    const r = now.result.identitySelection;
    if (v2Arch !== v3Arch) {
      changed++;
      if (r.pairIndex === null || r.pairIndex < IDENTITY_PAIR_COUNT_BY_ENGINE['2']) {
        unexpected.push({ path: `[${base.name}] v2 → v3 change not caused by a new catalog pair`, expected: v2Arch, actual: v3Arch });
      }
    }
    console.log(`  ${v2Arch === v3Arch ? '=' : '≠'} [${base.name}] ${v2Arch} → ${v3Arch}`
      + `   (${r.decision}${r.representativeTrait ? `, 대표 ${r.representativeTrait}` : ''}, pair #${r.pairIndex}${r.usedAuthoredOrder ? ', authored order' : ''})`);
  });
  console.log(`  Identity changed in ${changed} of ${v2.length} cases`);
  if (unexpected.length) {
    failed = true;
    console.log(`FAIL: ${unexpected.length} unexpected v2 → v3 change(s)`);
    printDiffs(unexpected);
  } else {
    console.log('PASS: v2 baseline differs only in approved catalog-addition fields; v2 selection reproduced');
  }
}

// ── 3. engine v3 baseline: exact (on the v3 view) ──
const v3Actual = actual.map((a: { name: string; result: unknown }) => ({ name: a.name, result: a.result }));
const v3Diffs: Diff[] = [];
diff(JSON.parse(readFileSync(V3_PATH, 'utf8')), v3Actual, 'cases', v3Diffs);
if (v3Diffs.length) {
  failed = true;
  console.log(`FAIL: ${v3Diffs.length} difference(s) from the v3 baseline`);
  printDiffs(v3Diffs);
} else {
  console.log(`PASS: ${v3Actual.length} golden cases match v3 baseline (v3 view)`);
}

// ── 4. engine v4: allowed differences from the v3 view + exact v4 baseline ──
const V4_ALLOWED = ['output.commonKeywords', 'output.detailedReading', 'output.tarotFlow', 'output.identityStatement', 'output.archetype',
  'destinyCode', 'engineVersion', 'identitySelection'];
const v4Actual = JSON.parse(JSON.stringify(v4Snapshots.map((s, i) => ({
  name: CASES[i].name,
  result: { ...fromSnapshot(s), identityNarrative: s.identityNarrative, intersection: s.intersection },
}))));
{
  const unexpected: Diff[] = [];
  let changed = 0;
  console.log('engine v3 → v4 golden comparison:');
  v4Actual.forEach((c: { name: string; result: Record<string, unknown> }, i: number) => {
    const ds: Diff[] = [];
    diff(v3Actual[i].result, without(c.result, ['identityNarrative', 'intersection']), 'result', ds);
    unexpected.push(...ds.filter((d) => !V4_ALLOWED.some((p) => d.path === `result.${p}` || d.path.startsWith(`result.${p}.`)))
      .map((d) => ({ ...d, path: `[${c.name}] ${d.path}` })));
    const kw3 = [...(v3Actual[i].result as { output: { commonKeywords: string[] } }).output.commonKeywords].sort().join();
    const kw4 = [...(c.result as { output: { commonKeywords: string[] } }).output.commonKeywords].sort().join();
    if (kw3 !== kw4) unexpected.push({ path: `[${c.name}] commonKeywords set changed`, expected: kw3, actual: kw4 });
    const a3 = (v3Actual[i].result as { output: { archetype: string } }).output.archetype;
    const a4 = (c.result as { output: { archetype: string } }).output.archetype;
    if (a3 !== a4) changed++;
    console.log(`  ${a3 === a4 ? '=' : '≠'} [${c.name}] ${a3} → ${a4}`);
  });
  console.log(`  Identity changed in ${changed} of ${v4Actual.length} cases`);
  if (unexpected.length) {
    failed = true;
    console.log(`FAIL: ${unexpected.length} unexpected v3 → v4 change(s)`);
    printDiffs(unexpected);
  } else {
    console.log('PASS: v4 differs from the v3 view only in keyword order, keyword-derived text, Identity and engineVersion');
  }
}
if (process.argv.includes('--capture-v4')) {
  if (failed) {
    console.log('REFUSED: not writing the v4 baseline while earlier checks fail');
    process.exit(1);
  }
  writeFileSync(V4_PATH, JSON.stringify(v4Actual, null, 2) + '\n');
  console.log(`Captured ${v4Actual.length} v4 golden cases -> ${V4_PATH}`);
  process.exit(0);
}
const v4Diffs: Diff[] = [];
diff(JSON.parse(readFileSync(V4_PATH, 'utf8')), v4Actual, 'cases', v4Diffs);
if (v4Diffs.length) {
  failed = true;
  console.log(`FAIL: ${v4Diffs.length} difference(s) from the v4 baseline`);
  printDiffs(v4Diffs);
} else {
  console.log(`PASS: ${v4Actual.length} golden cases match v4 baseline`);
}

if (failed) process.exit(1);
console.log(`PASS: golden v1/v2/v3/v4 checks (${v4Actual.length} cases)`);
