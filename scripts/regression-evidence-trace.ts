// One-off regression checks for Phase 2A evidence traceability.
//
//   npx -y tsx scripts/regression-evidence-trace.ts
//
// Verifies that AnalysisSnapshot.trace records the provenance of the existing
// CoreTags without changing them, and that saved v2 / legacy results are never
// backfilled with a trace. See docs/ai/CODEX_REVIEW.md (회귀·수용 기준).

const store: Record<string, string> = {};
const g = globalThis as Record<string, unknown>;
g.window = globalThis;
g.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
};

import { analyzeDestiny, TAROT_DATA, type AnalysisSnapshot, type CoreTag, type ElementKey } from '../app/lib/analysis';
import { buildAnalysisTrace, type AnalysisTrace, type AnalysisTraceInput } from '../app/lib/evidenceTrace';
import { getSavedAnalyses, deleteAnalysis } from '../app/lib/storageEngine';
import { activeFromNewAnalysis, activeFromSaved, saveActive } from '../app/lib/activeAnalysis';

const STORAGE_KEY = 'destiny_ai_v1';
let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) failures++;
}

function reset() {
  for (const k of Object.keys(store)) delete store[k];
}

const dedupe = <T,>(xs: T[]) => xs.filter((x, i) => xs.indexOf(x) === i);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface Case {
  name: string; birthdate: string; birthtime: string; mbti: string; gender: string; bloodtype: string;
  cardIndex: number; lat?: number; lon?: number; calendarType: 'solar' | 'lunar'; isLeapMonth: boolean;
}

// Same inputs as scripts/golden-analysis.ts
const CASES: Case[] = [
  { name: 'solar, full input, Seoul',     birthdate: '1990-05-15', birthtime: '14:30', mbti: 'INTJ', gender: 'male',   bloodtype: 'A',  cardIndex: 0,  lat: 37.5665, lon: 126.978, calendarType: 'solar', isLeapMonth: false },
  { name: 'solar, no time, no place',     birthdate: '1985-12-01', birthtime: '',      mbti: 'ENFP', gender: 'female', bloodtype: 'B',  cardIndex: 5,  calendarType: 'solar', isLeapMonth: false },
  { name: 'solar, no MBTI',               birthdate: '2000-02-29', birthtime: '06:00', mbti: '',     gender: 'female', bloodtype: 'O',  cardIndex: 10, lat: 35.1796, lon: 129.0756, calendarType: 'solar', isLeapMonth: false },
  { name: 'lunar, regular month',         birthdate: '1978-08-15', birthtime: '22:00', mbti: 'ISTP', gender: 'male',   bloodtype: 'AB', cardIndex: 15, lat: 33.4996, lon: 126.5312, calendarType: 'lunar', isLeapMonth: false },
  { name: 'lunar, leap month',            birthdate: '2020-04-10', birthtime: '09:30', mbti: 'ESFJ', gender: 'female', bloodtype: 'A',  cardIndex: 20, lat: 37.5665, lon: 126.978, calendarType: 'lunar', isLeapMonth: true },
  { name: 'ISFP + fire sign + A',         birthdate: '1992-04-05', birthtime: '03:15', mbti: 'ISFP', gender: 'male',   bloodtype: 'A',  cardIndex: 3,  lat: 37.5665, lon: 126.978, calendarType: 'solar', isLeapMonth: false },
  { name: 'water sign, thinking, B + SJ', birthdate: '1995-07-10', birthtime: '12:00', mbti: 'ISTJ', gender: 'female', bloodtype: 'B',  cardIndex: 21, calendarType: 'solar', isLeapMonth: false },
];

function analyze(c: Case, withCard = true): AnalysisSnapshot {
  return analyzeDestiny(
    c.birthdate, c.birthtime, c.mbti, c.gender, c.bloodtype,
    withCard ? TAROT_DATA[c.cardIndex % TAROT_DATA.length] : undefined,
    c.lat, c.lon, c.calendarType, c.isLeapMonth,
  );
}

const claimTraits = (t: AnalysisTrace, target: string) =>
  dedupe(t.claims.filter((c) => c.target === target).map((c) => c.trait));
const ev = (t: AnalysisTrace, id: string) => t.evidence.find((e) => e.id === id);

// ── 3, 4, 6: structure, per-target tag equality, values and ruleIds on real analyses ──
for (const c of CASES) {
  const s = analyze(c);
  const t = s.trace;
  const p = `[${c.name}]`;
  if (!t) { check(`${p} snapshot has trace`, false); continue; }
  check(`${p} trace.version is 1`, t.version === 1);

  const evIds = t.evidence.map((e) => e.id);
  const clIds = t.claims.map((x) => x.id);
  check(`${p} evidence ids unique`, new Set(evIds).size === evIds.length);
  check(`${p} claim ids unique`, new Set(clIds).size === clIds.length);
  check(`${p} every claim references existing, available evidence`, t.claims.every((x) =>
    x.evidenceIds.length > 0 && x.evidenceIds.every((id) => ev(t, id)?.status === 'available')));

  const wa = s.westernAstrology;
  const targets: Array<[string, CoreTag[]]> = [
    ['saju.coreTags', s.saju.coreTags],
    ['mbtiTraits.coreTags', s.mbtiTraits.coreTags],
    ['bloodType.coreTags', s.bloodType.coreTags],
    ['zodiac.coreTags', s.zodiac.coreTags],
    ['westernAstrology.sun.data.coreTags', wa.sun.data.coreTags],
    ['westernAstrology.moon.data.coreTags', wa.moon?.data.coreTags ?? []],
    ['westernAstrology.ascendant.data.coreTags', wa.ascendant?.data.coreTags ?? []],
    ['tarot.coreTags', s.tarot.coreTags],
  ];
  for (const [target, tags] of targets) {
    check(`${p} claims reproduce ${target}`, eq(claimTraits(t, target), tags),
      `claims ${JSON.stringify(claimTraits(t, target))} vs tags ${JSON.stringify(tags)}`);
  }
  const placementUnion = dedupe(['sun', 'moon', 'ascendant'].flatMap((n) =>
    claimTraits(t, `westernAstrology.${n}.data.coreTags`)));
  check(`${p} placement claims union equals westernAstrology.coreTags`, eq(placementUnion, wa.coreTags));
  check(`${p} no claim targets merged coreTags / westernAstrology.coreTags`,
    !t.claims.some((x) => x.target === 'coreTags' || x.target === 'westernAstrology.coreTags'));

  // Evidence values come from the actual source results, not copied tags
  check(`${p} saju dominant evidence value`, ev(t, 'saju:dominant-element')?.value === s.saju.dominantElement);
  const firstMissing = s.saju.missingElements[0];
  check(`${p} saju first-missing evidence only when missing exists`,
    firstMissing ? ev(t, 'saju:first-missing-element')?.value === firstMissing : !ev(t, 'saju:first-missing-element'));
  check(`${p} saju birth-time context`,
    ev(t, 'saju:birth-time-provided')?.value === s.saju.hasTime
    && (s.saju.hasTime ? !ev(t, 'saju:calculation-time-default') : ev(t, 'saju:calculation-time-default')?.value === '12:00'));
  check(`${p} time context is not linked to any claim`, !t.claims.some((x) =>
    x.evidenceIds.some((id) => id === 'saju:birth-time-provided' || id === 'saju:calculation-time-default')));
  check(`${p} mbti evidence`, s.mbtiTraits.type
    ? ev(t, 'mbti:type')?.value === s.mbtiTraits.type && ev(t, 'mbti:type')?.status === 'available'
    : ev(t, 'mbti:type')?.value === null && ev(t, 'mbti:type')?.status === 'missing');
  check(`${p} blood-type evidence`, ev(t, 'blood-type:type')?.value === s.bloodType.type);
  check(`${p} tarot evidence`, ev(t, 'tarot:card-number')?.value === s.tarot.number);
  check(`${p} sun-sign shared by zodiac and placement paths`,
    wa.sun.signKey === ev(t, 'western-astrology:sun-sign')?.value
    && !ev(t, 'western-astrology:zodiac-sign')
    && t.claims.filter((x) => x.target === 'zodiac.coreTags').every((x) => eq(x.evidenceIds, ['western-astrology:sun-sign'])));
  for (const n of ['moon', 'ascendant'] as const) {
    const pl = wa[n];
    const e = ev(t, `western-astrology:${n}-sign`);
    check(`${p} ${n}-sign evidence ${pl ? 'available' : 'missing'}`,
      pl ? e?.status === 'available' && e.value === pl.signKey : e?.status === 'missing' && e.value === null);
  }
  check(`${p} is-approximate recorded as-is`, ev(t, 'western-astrology:is-approximate')?.value === wa.isApproximate);

  const expectedRule: Record<string, [string, string]> = {
    'saju:dominant-element': ['saju.dominant-element-tags@1', 'symbolic'],
    'saju:first-missing-element': ['saju.missing-element-compensation@1', 'symbolic'],
    'mbti:type': ['mbti.type-tags@1', 'type-mapping'],
    'blood-type:type': ['blood-type.symbolic-tags@1', 'symbolic'],
    'tarot:card-number': ['tarot.card-tags@1', 'symbolic'],
  };
  check(`${p} ruleId / basis per evidence path`, t.claims.every((x) => {
    const [evId] = x.evidenceIds;
    if (x.target === 'zodiac.coreTags') return x.ruleId === 'zodiac.sign-tags@1' && x.basis === 'symbolic';
    if (evId.startsWith('western-astrology:')) return x.ruleId === 'western-astrology.placement-tags@1' && x.basis === 'symbolic';
    const [rule, basis] = expectedRule[evId] ?? [];
    return x.ruleId === rule && x.basis === basis;
  }));

  // Source order is fixed: saju, mbti, blood-type, western-astrology (zodiac then placements), tarot
  const order = ['saju', 'mbti', 'blood-type', 'western-astrology', 'tarot'];
  const srcSeq = t.evidence.map((e) => order.indexOf(e.source));
  check(`${p} evidence ordered by source`, srcSeq.every((v, i) => i === 0 || srcSeq[i - 1] <= v));
}

// ── 5: saju paths with an explicit fixture (dominant, compensation, duplicates, 3-limit, none missing) ──
{
  const table: Record<ElementKey, CoreTag[]> = {
    wood: ['창의적', '독립적'], fire: ['열정적', '직관적'], earth: ['포용적', '실용적'],
    metal: ['분석적', '체계적'], water: ['직관적', '창의적'],
  };
  const base = analyze(CASES[0]);
  const sajuWith = (dominant: ElementKey, missing: ElementKey[], coreTags: CoreTag[]): AnalysisTraceInput => ({
    saju: { ...base.saju, dominantElement: dominant, missingElements: missing, coreTags, hasTime: false },
    zodiacKey: base.westernAstrology.sun.signKey, zodiac: base.zodiac, westernAstrology: base.westernAstrology,
    mbti: base.mbtiTraits, bloodType: base.bloodType, tarot: base.tarot, elementCoreTags: table,
  });
  const sajuClaims = (t: AnalysisTrace) => t.claims.filter((x) => x.target === 'saju.coreTags')
    .map((x) => `${x.evidenceIds[0]}>${x.trait}`);

  // fire + water missing: [열정적, 직관적] + [직관적, 창의적] → [열정적, 직관적, 창의적]
  const dup = buildAnalysisTrace(sajuWith('fire', ['water'], ['열정적', '직관적', '창의적']));
  check('saju fixture: duplicate tag keeps both path claims', eq(sajuClaims(dup), [
    'saju:dominant-element>열정적', 'saju:dominant-element>직관적',
    'saju:first-missing-element>직관적', 'saju:first-missing-element>창의적',
  ]), JSON.stringify(sajuClaims(dup)));

  // wood + metal missing: 4 unique tags, cut to 3 → 체계적 must not be claimed
  const cut = buildAnalysisTrace(sajuWith('wood', ['metal'], ['창의적', '독립적', '분석적']));
  check('saju fixture: tag dropped by 3-limit is not claimed', eq(sajuClaims(cut), [
    'saju:dominant-element>창의적', 'saju:dominant-element>독립적', 'saju:first-missing-element>분석적',
  ]), JSON.stringify(sajuClaims(cut)));

  // no missing element: only dominant path, no invented compensation evidence
  const none = buildAnalysisTrace(sajuWith('earth', [], ['포용적', '실용적']));
  check('saju fixture: no missing element → no compensation evidence/claims',
    !ev(none, 'saju:first-missing-element') && eq(sajuClaims(none), [
      'saju:dominant-element>포용적', 'saju:dominant-element>실용적']));
  check('saju fixture: no time → calculation-time-default recorded', ev(none, 'saju:calculation-time-default')?.value === '12:00');

  // zodiac / sun mismatch is recorded separately, never silently merged
  const mismatch = buildAnalysisTrace({ ...sajuWith('earth', [], ['포용적', '실용적']),
    zodiacKey: base.westernAstrology.sun.signKey === 'aries' ? 'taurus' : 'aries' });
  check('zodiac fixture: key mismatch gets its own evidence',
    !!ev(mismatch, 'western-astrology:zodiac-sign')
    && mismatch.claims.filter((x) => x.target === 'zodiac.coreTags').every((x) => eq(x.evidenceIds, ['western-astrology:zodiac-sign'])));
}

// ── 6: tarot does not join the merged coreTags union ──
for (const c of CASES) {
  const s = analyze(c);
  const wa = s.westernAstrology;
  const merged = dedupe([...s.saju.coreTags, ...wa.coreTags,
    ...(s.mbtiTraits.type ? s.mbtiTraits.coreTags : []), ...s.bloodType.coreTags]);
  check(`[${c.name}] merged coreTags unchanged (tarot excluded)`, eq(s.coreTags, merged));
}

// ── 7: determinism, no input mutation, no randomness/time inside the builder ──
{
  const s = analyze(CASES[0]);
  const input: AnalysisTraceInput = {
    saju: s.saju, zodiacKey: s.westernAstrology.sun.signKey, zodiac: s.zodiac, westernAstrology: s.westernAstrology,
    mbti: s.mbtiTraits, bloodType: s.bloodType, tarot: s.tarot,
    elementCoreTags: { wood: ['창의적', '독립적'], fire: ['열정적', '직관적'], earth: ['포용적', '실용적'], metal: ['분석적', '체계적'], water: ['직관적', '창의적'] },
  };
  const before = JSON.stringify(input);
  const realRandom = Math.random, realNow = Date.now;
  let touched = false;
  Math.random = () => { touched = true; return 0.5; };
  Date.now = () => { touched = true; return 0; };
  const t1 = buildAnalysisTrace(input);
  const t2 = buildAnalysisTrace(input);
  Math.random = realRandom; Date.now = realNow;
  check('builder is deterministic', eq(t1, t2));
  check('builder does not use Math.random / Date.now', !touched);
  check('builder does not mutate its input', JSON.stringify(input) === before);
  check('trace equals analyzeDestiny trace for same sources', eq(analyze(CASES[0]).trace, analyze(CASES[0]).trace));

  // random-card path: same number of Math.random calls as before Phase 2A (calcTarot 1 + analysisId 1)
  let calls = 0;
  Math.random = () => { calls++; return realRandom(); };
  const noCard = analyze(CASES[1], false);
  Math.random = realRandom;
  check('no-card path: Math.random call count unchanged (2)', calls === 2, `got ${calls}`);
  check('no-card path: trace records the drawn card', ev(noCard.trace!, 'tarot:card-number')?.value === noCard.tarot.number);
  calls = 0;
  Math.random = () => { calls++; return realRandom(); };
  analyze(CASES[1], true);
  Math.random = realRandom;
  check('card path: Math.random call count unchanged (1)', calls === 1, `got ${calls}`);
}

// ── 8: persistence of a snapshot with trace ──
{
  reset();
  const s = analyze(CASES[0]);
  const meta = { nickname: 'n', birthdate: CASES[0].birthdate, mbti: CASES[0].mbti, bloodtype: CASES[0].bloodtype };
  saveActive(activeFromNewAnalysis(s, meta));
  const afterFirst = store[STORAGE_KEY];
  const saved = getSavedAnalyses()[0];
  check('saved snapshot with trace reloads deep-equal', saved.kind === 'v2' && eq(saved.resultData, s));
  check('reloaded trace deep-equal', saved.kind === 'v2' && eq(saved.resultData.trace, s.trace));
  saveActive(activeFromSaved(saved));
  check('re-saving same analysis leaves storage untouched', store[STORAGE_KEY] === afterFirst);
}

// ── 9: v2 without trace and real legacy entries are never backfilled ──
{
  reset();
  const s = analyze(CASES[6]);
  // v2 as written by Phase 1 (before trace existed)
  const v2NoTrace: Record<string, unknown> = { ...s };
  delete v2NoTrace.trace;
  // legacy AnalysisOutput as written before AnalysisSnapshot existed
  const legacy: Record<string, unknown> = { ...s };
  for (const k of ['schemaVersion', 'engineVersion', 'analysisId', 'createdAt', 'conflicts', 'keywordStrengths', 'coreTags', 'trace']) {
    delete legacy[k];
  }
  const meta = { nickname: 'old', birthdate: '1995-07-10', mbti: 'ISTJ', bloodtype: 'B', keywords: [], tarotName: 't', zodiacSign: 'z' };
  const entries = [
    { ...meta, id: 'v2-no-trace', createdAt: '2026-09-01T00:00:00.000Z', resultData: v2NoTrace },
    { ...meta, id: 'legacy-1', createdAt: '2026-01-01T00:00:00.000Z', resultData: legacy },
  ];
  const original = JSON.stringify(entries);
  store[STORAGE_KEY] = original;

  const list = getSavedAnalyses();
  const v2 = list.find((x) => x.id === 'v2-no-trace')!;
  const lg = list.find((x) => x.id === 'legacy-1')!;
  check('v2 without trace still reads as v2', v2.kind === 'v2');
  check('legacy still reads as legacy', lg.kind === 'legacy');
  check('reading does not add trace', !('trace' in v2.resultData) && !('trace' in lg.resultData));

  for (const x of [v2, lg]) saveActive(activeFromSaved(x));
  check('re-saving opened entries leaves storage byte-identical', store[STORAGE_KEY] === original);

  for (const x of [v2, lg]) deleteAnalysis(x.id);
  for (const x of [v2, lg]) saveActive(activeFromSaved(x));
  const again = getSavedAnalyses();
  check('re-saving after delete does not add trace',
    again.length === 2 && again.every((x) => !('trace' in x.resultData)));
  check('re-saving after delete keeps kinds', again.find((x) => x.id === 'v2-no-trace')?.kind === 'v2'
    && again.find((x) => x.id === 'legacy-1')?.kind === 'legacy');
}

// ── 10: size report (informational) ──
{
  reset();
  const sizes = CASES.map((c) => {
    const s = analyze(c);
    return { trace: JSON.stringify(s.trace).length, snapshot: JSON.stringify(s).length };
  });
  const maxTrace = Math.max(...sizes.map((x) => x.trace));
  const maxSnap = Math.max(...sizes.map((x) => x.snapshot));
  for (let i = 0; i < 10; i++) {
    const s = analyze(CASES[i % CASES.length]);
    saveActive(activeFromNewAnalysis(s, { nickname: `n${i}`, birthdate: s.saju.pillars.year, mbti: '', bloodtype: '' }));
  }
  const listBytes = new TextEncoder().encode(store[STORAGE_KEY]).length;
  console.log(`\nINFO: trace JSON max ${maxTrace} chars, snapshot JSON max ${maxSnap} chars `
    + `(trace ≈ ${Math.round((maxTrace / maxSnap) * 100)}% of snapshot); 10 saved entries = ${listBytes} bytes`);
  check('trace carries no raw birthdate / coordinates / narrative text',
    CASES.every((c) => {
      const j = JSON.stringify(analyze(c).trace);
      return !j.includes(c.birthdate) && !(c.lat && j.includes(String(c.lat))) && !j.includes('당신');
    }));
}

if (failures) {
  console.log(`\nFAIL: ${failures} evidence-trace check(s) failed`);
  process.exit(1);
}
console.log('\nPASS: all evidence-trace regression checks');
