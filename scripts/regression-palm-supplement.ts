// Palm Phase 1C Stage 1 regression: deterministic symbolic interpretation, supplementary comparison,
// separate supplement storage, A/B saved-result isolation and base-analysis invariance.
//
//   npx -y tsx scripts/regression-palm-supplement.ts
//
// Pure/local only: in-memory localStorage stub, no network, no provider.

const store: Record<string, string> = {};
const g = globalThis as Record<string, unknown>;
g.window = globalThis;
g.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

import { analyzeDestiny, IDENTITY_PAIR_DEFINITIONS, TAROT_DATA, type AnalysisOutput, type AnalysisSnapshot, type CoreTag } from '../app/lib/analysis';
import { deriveAnalysisPatterns, traitSupportInConvergenceScope } from '../app/lib/analysisPatterns';
import { generateDestinyCode } from '../app/lib/destinyCode';
import { buildPalmEvidence } from '../app/lib/palmEvidence';
import type { PalmLineObservation, PalmObservationBundle } from '../app/lib/palmObservation';
import { buildPalmInterpretation, PALM_SYMBOLIC_RULES } from '../app/lib/palmInterpretation';
import { baseTraitsOf, buildSupplementaryComparison } from '../app/lib/palmComparison';
import { isCurrentPalmAttempt, PalmAttemptTracker, shouldResetPalmOnDelete } from '../app/lib/palmAttempt';
import {
  parsePalmSupplement, PALM_COMPARISON_RULE_VERSION, PALM_INTERPRETATION_RULE_VERSION, type PalmSupplement,
} from '../app/lib/palmSupplement';
import {
  deletePalmSupplement, PALM_SUPPLEMENT_STORAGE_KEY, prunePalmSupplements, readPalmSupplement, savedBaseRef, savePalmSupplement,
  saveBaseThenPalm, savePendingPalmFor,
} from '../app/lib/palmSupplementStore';
import {
  checkPalmFile, palmErrorMessage, palmObservationRows, palmQualityNote, PALM_DISCLAIMER, PALM_PROCESSING_NOTICE_TEXT,
} from '../app/lib/palmPresentation';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deleteAnalysis, getSavedAnalyses } from '../app/lib/storageEngine';
import {
  activeBaseRef, activeDestinyCode, activeFromNewAnalysis, activeFromSaved, activeShareText, buildPalmSupplementFor, saveActive,
  type ActiveAnalysis,
} from '../app/lib/activeAnalysis';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) failures++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
const deepEq = (a: unknown, b: unknown) => eq(canon(a), canon(b));
const reset = () => { for (const k of Object.keys(store)) delete store[k]; };

// ── fixtures ──
const vis = (curvature: 'straight' | 'curved' | null, continuity: 'continuous' | 'interrupted' | null): PalmLineObservation => ({
  status: 'visible',
  curvature: curvature ? { status: 'observed', value: curvature } : { status: 'unreadable', reason: 'blur' },
  continuity: continuity ? { status: 'observed', value: continuity } : { status: 'unreadable', reason: 'blur' },
});
const NOT_DETECTED: PalmLineObservation = { status: 'not-detected' };
const UNREADABLE: PalmLineObservation = { status: 'unreadable', reason: 'cropped' };
function bundle(
  lines: { life: PalmLineObservation; head: PalmLineObservation; heart: PalmLineObservation; fate: PalmLineObservation },
  usability: 'usable' | 'partial' | 'unusable' = 'usable',
): PalmObservationBundle {
  return {
    version: 1,
    observation: { version: 1, lines },
    quality: { version: 1, usability, palmCoverage: usability === 'unusable' ? 'none' : usability === 'partial' ? 'partial' : 'full', issues: [] },
    extraction: { adapterVersion: 'openai-responses-1', modelRevision: 'gpt-4.1-2025-04-14', promptVersion: 'palm-vision-ko-1' },
  };
}
const FULL = bundle({ life: vis('curved', 'continuous'), head: vis('straight', 'continuous'), heart: vis('curved', 'continuous'), fate: vis('straight', 'continuous') });
const ids = (b: PalmObservationBundle) => buildPalmInterpretation(b).signals.map((s) => s.interpretationKey);

// ══ Stage 1a: deterministic interpretation ══
{
  const i1 = buildPalmInterpretation(FULL);
  check('interpretation: versioned palm-symbolic-1', i1.version === 1 && i1.ruleVersion === PALM_INTERPRETATION_RULE_VERSION);
  check('interpretation: exactly 8 authored rules in the catalog', PALM_SYMBOLIC_RULES.length === 8
    && eq(PALM_SYMBOLIC_RULES.map((r) => r.key), ['life-continuous', 'life-interrupted', 'head-straight', 'head-curved', 'heart-straight', 'heart-curved', 'fate-continuous', 'fate-interrupted']));
  check('interpretation: order life/head/heart/fate, max 1 per line', eq(ids(FULL), ['life-continuous', 'head-straight', 'heart-curved', 'fate-continuous']));
  check('interpretation: repeated execution is byte-identical', eq(buildPalmInterpretation(FULL), i1) && eq(buildPalmInterpretation(structuredClone(FULL)), i1));
  check('interpretation: ids/ruleIds derived from rule keys (no time/random)',
    i1.signals.every((s) => s.id === `palm.signal.${s.interpretationKey}` && s.ruleId === `palm.symbolic.${s.interpretationKey}@1` && s.basis === 'symbolic'));
  const evidence = new Map(buildPalmEvidence(FULL).map((e) => [e.id, e]));
  check('interpretation: evidenceIds point at available Palm Evidence with the observed value',
    i1.signals.every((s) => s.evidenceIds.length === 1 && evidence.get(s.evidenceIds[0])?.status === 'available'
      && evidence.get(s.evidenceIds[0])?.value === s.observedFeature.value
      && s.evidenceIds[0] === `palm:line:${s.line}:${s.observedFeature.attribute}`));
  check('interpretation: no numeric confidence, no health/lifespan/future wording',
    !/confidence|score|수명|건강|질병|성공|미래|운명적/.test(JSON.stringify(i1)));
  check('interpretation: trait only on authored rules (분석적/창의적/감성적/체계적)',
    eq(PALM_SYMBOLIC_RULES.filter((r) => r.trait).map((r) => `${r.key}:${r.trait}`), ['head-straight:분석적', 'head-curved:창의적', 'heart-curved:감성적', 'fate-continuous:체계적']));
}

// all 8 rules individually
const RULE_CASES: Array<[string, PalmObservationBundle]> = [
  ['life-continuous', bundle({ life: vis(null, 'continuous'), head: NOT_DETECTED, heart: NOT_DETECTED, fate: NOT_DETECTED })],
  ['life-interrupted', bundle({ life: vis(null, 'interrupted'), head: NOT_DETECTED, heart: NOT_DETECTED, fate: NOT_DETECTED })],
  ['head-straight', bundle({ life: NOT_DETECTED, head: vis('straight', null), heart: NOT_DETECTED, fate: NOT_DETECTED })],
  ['head-curved', bundle({ life: NOT_DETECTED, head: vis('curved', null), heart: NOT_DETECTED, fate: NOT_DETECTED })],
  ['heart-straight', bundle({ life: NOT_DETECTED, head: NOT_DETECTED, heart: vis('straight', null), fate: NOT_DETECTED })],
  ['heart-curved', bundle({ life: NOT_DETECTED, head: NOT_DETECTED, heart: vis('curved', null), fate: NOT_DETECTED })],
  ['fate-continuous', bundle({ life: NOT_DETECTED, head: NOT_DETECTED, heart: NOT_DETECTED, fate: vis(null, 'continuous') })],
  ['fate-interrupted', bundle({ life: NOT_DETECTED, head: NOT_DETECTED, heart: NOT_DETECTED, fate: vis(null, 'interrupted') })],
];
for (const [key, b] of RULE_CASES) {
  const rule = PALM_SYMBOLIC_RULES.find((r) => r.key === key)!;
  const s = buildPalmInterpretation(b).signals;
  check(`rule ${key}: fires alone with its fixed authored text`, s.length === 1 && s[0].interpretationKey === key && s[0].text === rule.text && s[0].trait === rule.trait);
}

// missing / unreadable / partial / unusable
{
  check('unreadable attributes: no signal (life curvature-only, head continuity-only)',
    eq(ids(bundle({ life: vis('curved', null), head: vis(null, 'interrupted'), heart: vis(null, 'continuous'), fate: vis('curved', null) })), []));
  check('not-detected lines: no signal and no default trait', eq(ids(bundle({ life: NOT_DETECTED, head: NOT_DETECTED, heart: NOT_DETECTED, fate: NOT_DETECTED })), []));
  check('unreadable lines: no signal', eq(ids(bundle({ life: UNREADABLE, head: UNREADABLE, heart: UNREADABLE, fate: UNREADABLE }, 'partial')), []));
  check('partial image: only read attributes are interpreted',
    eq(ids(bundle({ life: UNREADABLE, head: vis('curved', 'continuous'), heart: NOT_DETECTED, fate: vis(null, 'interrupted') }, 'partial')), ['head-curved', 'fate-interrupted']));
  check('unusable image: 0 signals', buildPalmInterpretation(bundle({ life: UNREADABLE, head: UNREADABLE, heart: UNREADABLE, fate: UNREADABLE }, 'unusable')).signals.length === 0);
  let threw = false;
  try { buildPalmInterpretation({ ...FULL, version: 2 } as unknown as PalmObservationBundle); } catch { threw = true; }
  check('invalid bundle is rejected by the Phase 1A parser (no partial interpretation)', threw);
}

// ══ Stage 1b: supplementary comparison ══
{
  const interp = buildPalmInterpretation(FULL); // life-continuous(-), head-straight(분석적), heart-curved(감성적), fate-continuous(체계적)
  const kinds = (base: CoreTag[] | null) => buildSupplementaryComparison(interp, base).items.map((i) => `${i.signalId.replace('palm.signal.', '')}:${i.kind}${i.counterpart ? `:${i.counterpart}` : ''}`);
  check('MATCH: trait present in base coreTags', kinds(['분석적']).includes('head-straight:MATCH:분석적'));
  check('TENSION: authored pair 분석적↔감성적 (base has 감성적 for head-straight)', kinds(['감성적']).includes('head-straight:TENSION:감성적'));
  check('TENSION: authored pair 창의적↔체계적 (base has 창의적 for fate-continuous)', kinds(['창의적']).includes('fate-continuous:TENSION:창의적'));
  check('MATCH + TENSION coexist as separate items for one signal',
    eq(kinds(['분석적', '감성적']).filter((k) => k.startsWith('head-straight')), ['head-straight:MATCH:분석적', 'head-straight:TENSION:감성적']));
  check('UNIQUE: trait-less signal', kinds(['분석적']).includes('life-continuous:UNIQUE'));
  check('UNIQUE: trait without match/tension in base', kinds(['사교적']).includes('head-straight:UNIQUE'));
  check('exactly one of UNIQUE vs related per signal', (() => {
    const k = kinds(['분석적', '감성적', '창의적']);
    return interp.signals.every((s) => {
      const own = k.filter((x) => x.startsWith(s.interpretationKey + ':'));
      return own.includes(`${s.interpretationKey}:UNIQUE`) ? own.length === 1 : own.length >= 1;
    });
  })());
  check('ordering: signal order, then MATCH → TENSION → UNIQUE',
    eq(kinds(['분석적', '감성적', '체계적']), ['life-continuous:UNIQUE', 'head-straight:MATCH:분석적', 'head-straight:TENSION:감성적', 'heart-curved:MATCH:감성적', 'heart-curved:TENSION:분석적', 'fate-continuous:MATCH:체계적']));
  const c1 = buildSupplementaryComparison(interp, ['분석적', '감성적']);
  check('comparison: deterministic and versioned', eq(c1, buildSupplementaryComparison(interp, ['분석적', '감성적'])) && c1.ruleVersion === PALM_COMPARISON_RULE_VERSION && c1.basis === 'snapshot-coreTags');
  check('comparison: baseTraits is a copy of the given coreTags', eq(c1.baseTraits, ['분석적', '감성적']));
  check('comparison: no duplicate items', new Set(c1.items.map((i) => i.id)).size === c1.items.length);
  const legacy = buildSupplementaryComparison(interp, null);
  check('legacy base: basis unavailable, no items, no reconstructed traits', legacy.basis === 'unavailable' && legacy.items.length === 0 && legacy.baseTraits.length === 0);
  check('no signals → no items', buildSupplementaryComparison(buildPalmInterpretation(RULE_CASES[0][1]), []).items.length === 1
    && buildSupplementaryComparison({ ...interp, signals: [] }, ['분석적']).items.length === 0);
  check('comparison text is fixed-template (no numbers/probabilities)', c1.items.every((i) => !/\d|%|확률|정확/.test(i.text)));
}

// ══ Stage 1c: base-analysis invariance (release blocker) ══
const inputA = { nickname: '사용자A', birthdate: '1995-07-10', mbti: 'ISTJ', bloodtype: 'B' };
const inputB = { nickname: '사용자B', birthdate: '1990-05-15', mbti: 'INTJ', bloodtype: 'A' };
const analyzeA = () => analyzeDestiny(inputA.birthdate, '12:00', inputA.mbti, 'female', inputA.bloodtype, TAROT_DATA[21]);
const analyzeB = () => analyzeDestiny(inputB.birthdate, '14:30', inputB.mbti, 'male', inputB.bloodtype, TAROT_DATA[0], 37.5665, 126.978);

function baseFingerprint(s: AnalysisSnapshot) {
  return JSON.stringify({
    engineVersion: s.engineVersion, schemaVersion: s.schemaVersion,
    archetype: s.archetype, identityStatement: s.identityStatement, identitySelection: s.identitySelection,
    coreTags: s.coreTags, conflicts: s.conflicts, keywordStrengths: s.keywordStrengths, commonKeywords: s.commonKeywords,
    trace: s.trace,
    convergence: s.trace ? [...traitSupportInConvergenceScope(s.trace).entries()] : null,
    patterns: s.trace ? deriveAnalysisPatterns(s.trace, IDENTITY_PAIR_DEFINITIONS) : null,
    destinyCode: generateDestinyCode(s),
  });
}
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
}
{
  const withoutPalm = analyzeA();
  const withPalm = analyzeA();
  // same inputs → same base (analysisId/createdAt excluded by fingerprint)
  check('invariance precondition: same base without Palm is reproducible', baseFingerprint(withoutPalm) === baseFingerprint(analyzeA()));
  const whole = JSON.stringify(withPalm);
  deepFreeze(withPalm); // any mutation attempt would throw
  const active = activeFromNewAnalysis(withPalm, inputA);
  let supplement: PalmSupplement | null = null;
  let threw = false;
  try {
    supplement = buildPalmSupplementFor(active, FULL, { id: 'sup-1', createdAt: '2026-09-30T00:00:00.000Z', noticeAcceptedAt: '2026-09-30T00:00:00.000Z' });
    buildPalmSupplementFor(active, bundle({ life: UNREADABLE, head: UNREADABLE, heart: UNREADABLE, fate: UNREADABLE }, 'unusable'), { id: 'sup-2', createdAt: '2026-09-30T00:00:00.000Z', noticeAcceptedAt: '2026-09-30T00:00:00.000Z' });
  } catch { threw = true; }
  check('INVARIANCE: building Palm supplements never mutates the (frozen) base snapshot', !threw && JSON.stringify(withPalm) === whole);
  check('INVARIANCE: identity/coreTags/conflicts/keywordStrengths/trace/convergence/patterns/Destiny Code identical with and without Palm',
    baseFingerprint(withPalm) === baseFingerprint(withoutPalm));
  check('INVARIANCE: Palm traits are not added to base coreTags', !!supplement && eq(withPalm.coreTags, withoutPalm.coreTags)
    && supplement.comparison.baseTraits.join() === withPalm.coreTags.join());
  check('INVARIANCE: engine 3 / schema 2 unchanged', withPalm.engineVersion === '3' && withPalm.schemaVersion === 2);
  check('INVARIANCE: snapshot has no Palm field', !/palm/i.test(Object.keys(withPalm).join(',')));
  check('INVARIANCE: share text unchanged by Palm (base only)', activeShareText(active) === activeShareText(activeFromNewAnalysis(withoutPalm, inputA)));
}

// ══ Stage 1d: supplement storage + A/B isolation (release blocker) ══
const NOW = { createdAt: '2026-09-30T01:00:00.000Z', noticeAcceptedAt: '2026-09-30T01:00:00.000Z' };
const HEAD_CURVED = bundle({ life: NOT_DETECTED, head: vis('curved', 'continuous'), heart: NOT_DETECTED, fate: NOT_DETECTED });
function addPalm(active: ActiveAnalysis, id: string, b: PalmObservationBundle = FULL): PalmSupplement {
  const s = buildPalmSupplementFor(active, b, { id, ...NOW })!;
  const r = savePalmSupplement(s);
  if (!r.ok) throw new Error(`save failed: ${r.reason}`);
  return s;
}
const openSaved = (analysisId: string) => activeFromSaved(getSavedAnalyses().find((s) => s.kind === 'v2' && s.resultData.analysisId === analysisId)!);

for (const order of ['A-first', 'B-first'] as const) {
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  const b = activeFromNewAnalysis(analyzeB(), inputB);
  const [first, second] = order === 'A-first' ? [a, b] : [b, a];
  saveActive(first);
  saveActive(second);
  const idA = (a.result as AnalysisSnapshot).analysisId, idB = (b.result as AnalysisSnapshot).analysisId;
  // open A, add Palm to A
  const openedA = openSaved(idA);
  const supA = addPalm(openedA, 'sup-A');
  // open B → nothing from A
  const openedB = openSaved(idB);
  const readB = readPalmSupplement(activeBaseRef(openedB));
  check(`A/B (${order}): B shows no Palm after Palm was added to A`, readB.status === 'none');
  check(`A/B (${order}): B's Destiny Code / share unaffected`, activeDestinyCode(openedB) === activeDestinyCode(b) && activeShareText(openedB) === activeShareText(b));
  // open A again → A's own supplement
  const readA = readPalmSupplement(activeBaseRef(openSaved(idA)));
  check(`A/B (${order}): reopening A shows A's own Palm supplement`, readA.status === 'ok' && readA.supplement.id === 'sup-A' && readA.supplement.baseRef.id === idA);
  check(`A/B (${order}): A's comparison uses A's saved coreTags, not B's`,
    readA.status === 'ok' && eq(readA.supplement.comparison.baseTraits, (a.result as AnalysisSnapshot).coreTags));
  // add Palm to B later → attached only to B
  const supB = addPalm(openSaved(idB), 'sup-B', HEAD_CURVED);
  const rA = readPalmSupplement(activeBaseRef(openSaved(idA))), rB = readPalmSupplement(activeBaseRef(openSaved(idB)));
  check(`A/B (${order}): Palm added later to B attaches only to B`, rA.status === 'ok' && rA.supplement.id === 'sup-A' && rB.status === 'ok' && rB.supplement.id === 'sup-B'
    && eq(rB.supplement.comparison.baseTraits, (b.result as AnalysisSnapshot).coreTags));
  check(`A/B (${order}): supplements are stored separately from base results`, !store['destiny_ai_v1'].includes('sup-A') && store[PALM_SUPPLEMENT_STORAGE_KEY].includes('sup-B'));
  void supA; void supB;
}

{
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  const s = buildPalmSupplementFor(a, FULL, { id: 'unsaved', ...NOW })!;
  check('store: supplement for an unsaved base is refused (memory only until the base is saved)', !savePalmSupplement(s).ok && !store[PALM_SUPPLEMENT_STORAGE_KEY]);
  saveActive(a);
  check('store: after saving the base, the supplement saves', savePalmSupplement(s).ok);
  saveActive(a); // duplicate base save (returns existing) must not drop the supplement
  check('store: duplicate base save keeps the supplement', readPalmSupplement(activeBaseRef(a)).status === 'ok');
  // replacing with a new success
  const s2 = buildPalmSupplementFor(a, HEAD_CURVED, { id: 'second', ...NOW })!;
  savePalmSupplement(s2);
  const r = readPalmSupplement(activeBaseRef(a));
  check('store: explicit new save replaces the previous supplement of the same base (one per base)', r.status === 'ok' && r.supplement.id === 'second'
    && (JSON.parse(store[PALM_SUPPLEMENT_STORAGE_KEY]) as unknown[]).length === 1);
  check('store: nothing image-like is persisted', !/base64|data:image|exif|preview|blob:|sha256|fingerprint/i.test(store[PALM_SUPPLEMENT_STORAGE_KEY]));
  // delete base → supplement pruned
  deleteAnalysis(getSavedAnalyses()[0].id);
  prunePalmSupplements();
  check('store: deleting the base removes its supplement (orphan prune)', readPalmSupplement(activeBaseRef(a)).status === 'none' && store[PALM_SUPPLEMENT_STORAGE_KEY] === '[]');
}

{
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  saveActive(a);
  const s = buildPalmSupplementFor(a, FULL, { id: 'x', ...NOW })!;
  savePalmSupplement(s);
  const tampered = JSON.parse(store[PALM_SUPPLEMENT_STORAGE_KEY]);
  tampered[0].version = 2;
  store[PALM_SUPPLEMENT_STORAGE_KEY] = JSON.stringify(tampered);
  check('store: unknown supplement version → "unsupported" (base still usable)', readPalmSupplement(activeBaseRef(a)).status === 'unsupported' && getSavedAnalyses().length === 1);
  store[PALM_SUPPLEMENT_STORAGE_KEY] = '{not json';
  check('store: corrupted storage → none, no throw', readPalmSupplement(activeBaseRef(a)).status === 'none');
  deletePalmSupplement(activeBaseRef(a)!);
  // storage failure
  const realSet = (g.localStorage as { setItem: (k: string, v: string) => void }).setItem;
  (g.localStorage as { setItem: unknown }).setItem = (k: string, v: string) => { if (k === PALM_SUPPLEMENT_STORAGE_KEY) throw new Error('quota'); store[k] = v; };
  check('store: quota failure reported as storage-failed', eq(savePalmSupplement(s), { ok: false, reason: 'storage-failed' }));
  (g.localStorage as { setItem: unknown }).setItem = realSet;
}

{
  reset();
  // legacy saved result: attach by savedId, comparison unavailable
  const legacyOutput: Record<string, unknown> = { ...analyzeA() };
  for (const k of ['schemaVersion', 'engineVersion', 'analysisId', 'createdAt', 'conflicts', 'keywordStrengths', 'coreTags', 'trace', 'identitySelection']) delete legacyOutput[k];
  store['destiny_ai_v1'] = JSON.stringify([{ ...inputA, keywords: [], tarotName: 't', zodiacSign: 'z', id: 'legacy1', createdAt: '2026-01-01T00:00:00.000Z', resultData: legacyOutput }]);
  const opened = activeFromSaved(getSavedAnalyses()[0]);
  check('legacy: baseRef is {legacy, savedId}', eq(activeBaseRef(opened), { kind: 'legacy', id: 'legacy1' }) && eq(savedBaseRef(getSavedAnalyses()[0]), activeBaseRef(opened)));
  check('legacy: comparison basis unavailable (not reconstructed)', baseTraitsOf(opened.result as AnalysisOutput) === null);
  const sup = addPalm(opened, 'legacy-sup');
  check('legacy: supplement saved with unavailable comparison and interpretation intact', sup.comparison.basis === 'unavailable' && sup.interpretation.signals.length === 4
    && readPalmSupplement({ kind: 'legacy', id: 'legacy1' }).status === 'ok');
  check('legacy: temporary legacy result without savedId cannot receive Palm', activeBaseRef({ ...opened, savedId: undefined }) === null
    && buildPalmSupplementFor({ ...opened, savedId: undefined }, FULL, { id: 'n', ...NOW }) === null);
  check('legacy/snapshot refs never collide on the same id string', readPalmSupplement({ kind: 'snapshot', id: 'legacy1' }).status === 'none');
}

{
  // savedId ≠ analysisId (historic entry): baseRef stays analysisId, delete/prune respects it
  reset();
  const snap = analyzeA();
  store['destiny_ai_v1'] = JSON.stringify([{ ...inputA, keywords: [], tarotName: 't', zodiacSign: 'z', id: 'old-saved-id', createdAt: '2026-01-01T00:00:00.000Z', resultData: snap }]);
  const opened = activeFromSaved(getSavedAnalyses()[0]);
  check('savedId≠analysisId: baseRef uses analysisId', eq(activeBaseRef(opened), { kind: 'snapshot', id: snap.analysisId }));
  addPalm(opened, 'hist');
  prunePalmSupplements();
  check('savedId≠analysisId: prune keeps it while the base exists', readPalmSupplement(activeBaseRef(opened)).status === 'ok');
  deleteAnalysis('old-saved-id');
  prunePalmSupplements();
  check('savedId≠analysisId: deleting the saved entry prunes the supplement', readPalmSupplement(activeBaseRef(opened)).status === 'none');
}

{
  // 10-item eviction prunes supplements of evicted bases
  reset();
  const first = activeFromNewAnalysis(analyzeA(), inputA);
  saveActive(first);
  addPalm(first, 'evicted');
  for (let i = 0; i < 10; i++) saveActive(activeFromNewAnalysis(analyzeB(), inputB));
  prunePalmSupplements();
  check('eviction: base evicted by the 10-item limit → its supplement is pruned', getSavedAnalyses().length === 10 && readPalmSupplement(activeBaseRef(first)).status === 'none');
}

// ══ Stage 1e: late-response guard ══
{
  const A = { kind: 'snapshot' as const, id: 'A' }, B = { kind: 'snapshot' as const, id: 'B' };
  check('attempt guard: same base + same attempt → apply', isCurrentPalmAttempt({ baseRef: A, attemptId: '1' }, { baseRef: A, attemptId: '1' }));
  check('attempt guard: response for A after switching to B → discard', !isCurrentPalmAttempt({ baseRef: A, attemptId: '1' }, { baseRef: B, attemptId: '1' }));
  check('attempt guard: older retry response → discard', !isCurrentPalmAttempt({ baseRef: A, attemptId: '1' }, { baseRef: A, attemptId: '2' }));
  check('attempt guard: no current attempt → discard', !isCurrentPalmAttempt({ baseRef: A, attemptId: '1' }, { baseRef: A, attemptId: null }));
}

// supplement parser round-trip
{
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  const s = buildPalmSupplementFor(a, FULL, { id: 'rt', ...NOW })!;
  check('parser: built supplement round-trips through JSON', deepEq(parsePalmSupplement(JSON.parse(JSON.stringify(s))), s));
  let threw = false;
  try { parsePalmSupplement({ ...s, photo: 'data:image/jpeg;base64,AAAA' }); } catch { threw = true; }
  check('parser: extra fields (e.g. a photo) are rejected', threw);
}

// ══ Stage 3: page save flow (pending Palm), presentation, UI wiring ══
{
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  const b = activeFromNewAnalysis(analyzeB(), inputB);
  const pendingA = buildPalmSupplementFor(a, FULL, { id: 'pending-A', ...NOW })!;
  saveActive(b);
  check('page save: pending Palm of A is NOT saved when result B is being saved', eq(savePendingPalmFor(activeBaseRef(b), pendingA), { ok: false, reason: 'other-result' })
    && readPalmSupplement(activeBaseRef(b)).status === 'none' && readPalmSupplement(activeBaseRef(a)).status === 'none');
  saveActive(a);
  check('page save: pending Palm of A is saved after base A is saved', savePendingPalmFor(activeBaseRef(a), pendingA).ok
    && readPalmSupplement(activeBaseRef(a)).status === 'ok' && readPalmSupplement(activeBaseRef(b)).status === 'none');
  check('page save: no pending → nothing written', eq(savePendingPalmFor(activeBaseRef(b), null), { ok: false, reason: 'none' }));
}
{
  check('file check: HEIC/HEIF rejected with guidance (by type or extension)',
    checkPalmFile({ type: 'image/heic', name: 'a.heic', size: 10 }) === 'heic' && checkPalmFile({ type: '', name: 'IMG_1.HEIF', size: 10 }) === 'heic');
  check('file check: JPEG/PNG/WebP ≤ 4 MB accepted; other types / oversize / empty refused',
    checkPalmFile({ type: 'image/jpeg', name: 'a.jpg', size: 1000 }) === null && checkPalmFile({ type: 'image/webp', name: 'a.webp', size: 1 }) === null
    && checkPalmFile({ type: 'image/gif', name: 'a.gif', size: 10 }) === 'type' && checkPalmFile({ type: 'image/png', name: 'a.png', size: 4_000_001 }) === 'size'
    && checkPalmFile({ type: 'image/png', name: 'a.png', size: 0 }) === 'empty');
  const codes = ['INVALID_IMAGE', 'IMAGE_TOO_LARGE', 'RATE_LIMITED', 'DUPLICATE_IMAGE', 'DUPLICATE_REQUEST', 'REQUEST_CONFLICT', 'PROVIDER_TIMEOUT', 'PROVIDER_ERROR', 'INVALID_PROVIDER_RESPONSE', 'SESSION_REQUIRED', 'UNAVAILABLE', 'NETWORK', 'weird'];
  check('error messages: every code maps to Korean guidance without raw codes', codes.every((c) => /[가-힣]/.test(palmErrorMessage(c)) && !palmErrorMessage(c).includes(c)));
  check('error messages: lost result explains that a retry is a new request', palmErrorMessage('PROVIDER_TIMEOUT').includes('새 요청'));
  const rows = palmObservationRows(FULL);
  check('presentation: four readable rows with everyday hints, no rule ids/JSON/confidence',
    rows.length === 4 && rows.every((r) => r.hint.length > 0) && !/palm\.|ruleId|confidence|\{|\}/.test(JSON.stringify(rows.map((r) => r.summary))));
  check('presentation: unusable / partial notes', !!palmQualityNote(bundle({ life: UNREADABLE, head: UNREADABLE, heart: UNREADABLE, fate: UNREADABLE }, 'unusable'))
    && !!palmQualityNote(bundle({ life: UNREADABLE, head: vis('curved', null), heart: NOT_DETECTED, fate: NOT_DETECTED }, 'partial')) && palmQualityNote(FULL) === null);
  check('disclosure text: exact required meaning', PALM_DISCLAIMER === '손바닥 분석은 AI 기반의 해석적 콘텐츠이며 과학적·의학적 판단이나 미래 예측을 제공하지 않습니다.');
  check('processing notice: names the external AI service and does not promise zero retention',
    PALM_PROCESSING_NOTICE_TEXT.includes('OpenAI') && !/어디에도 저장되지 않|전혀 저장되지 않|보관하지 않습니다\.$/.test(PALM_PROCESSING_NOTICE_TEXT));
  const root = join(__dirname, '..');
  const page = readFileSync(join(root, 'app/page.tsx'), 'utf8');
  const panel = readFileSync(join(root, 'app/components/PalmSupplementPanel.tsx'), 'utf8');
  check('UI: panel is keyed by the result baseRef (fresh state per result)', /key=\{`\$\{ref\.kind\}:\$\{ref\.id\}:/.test(page));
  check('UI: upload happens only from the explicit analyze action (no request on mount)',
    (panel.match(/requestPalmObservation\(/g) ?? []).length === 1 && /const analyze = async/.test(panel) && !/useEffect\([^]*?requestPalmObservation/.test(panel.split('const releasePhoto')[0]));
  check('UI: camera + gallery inputs, accept limited to JPEG/PNG/WebP', /capture="environment"/.test(panel) && (panel.match(/type="file"/g) ?? []).length === 2 && /accept=\{PALM_ACCEPT\}/.test(panel));
  check('UI: analyze button requires the processing notice to be confirmed', /disabled=\{!noticeAcceptedAt \|\| busy\}/.test(panel));
  check('UI: late responses are discarded via the per-mount attempt tracker', (panel.match(/if \(!isCurrent\(\)\) return/g) ?? []).length >= 2
    && /tracker\.invalidate\(\)/.test(panel) && /URL\.revokeObjectURL/.test(panel));
  check('UI: deleting the active result remounts the Palm card (generation key) and clears pending Palm',
    /key=\{`\$\{ref\.kind\}:\$\{ref\.id\}:\$\{palmGeneration\}`\}/.test(page) && /shouldResetPalmOnDelete\(activeBaseRef\(active\), savedBaseRef\(saved\)\)/.test(page)
    && /setPalmGeneration\(\(g\) => g \+ 1\)/.test(page));
  check('UI: panel and page save base-then-Palm through the guarded helper', /saveBaseThenPalm\(\(\) => saveActive\(active\), baseRef, fresh\)/.test(panel)
    && /saveBaseThenPalm\(\(\) => saveActive\(active\), activeBaseRef\(active\), pendingPalm\)/.test(page) && !/savePalmSupplement\(/.test(panel));
  check('UI: no raw JSON / rule ids / provider metadata rendered', !/JSON\.stringify|ruleId|modelRevision|adapterVersion|promptVersion/.test(panel));
  check('UI: photo never stored (no localStorage/sessionStorage/FileReader/base64 in the panel)', !/localStorage|sessionStorage|FileReader|readAsDataURL|base64/.test(panel));
  check('UI: share stays base-only (activeShareText untouched, note shown)', /PALM_SHARE_NOTE/.test(panel) && !/palm/i.test(readFileSync(join(root, 'app/lib/shareEngine.ts'), 'utf8')));
  check('UI: deleting a saved result also deletes its supplement', /deletePalmSupplement\(savedBaseRef\(saved\)\)/.test(page));
  check('analytics: existing saveAnalyticsResult payload has no Palm data', !/palm/i.test(readFileSync(join(root, 'app/lib/analyticsEngine.ts'), 'utf8')));
  const analytics = readFileSync(join(root, 'app/lib/palmAnalytics.ts'), 'utf8');
  check('analytics: client sends only event + random id (3 allowed events)', /JSON\.stringify\(\{ eventId: crypto\.randomUUID\(\), event \}\)/.test(analytics)
    && /'palm_prompt_viewed' \| 'palm_started' \| 'palm_retry'/.test(analytics));
}


// ══ M-2: deleting the active result invalidates its in-flight Palm (release-relevant) ══
{
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  saveActive(a);
  const refA = activeBaseRef(a)!;
  // open A, start Palm A (panel mount for A)
  const trackerA = new PalmAttemptTracker();
  const inflightA = trackerA.begin(refA, 'attempt-A');
  let pending: PalmSupplement | null = null;
  // delete A (the active result)
  deleteAnalysis(getSavedAnalyses()[0].id);
  deletePalmSupplement(refA);
  const reset1 = shouldResetPalmOnDelete(refA, refA);
  if (reset1) { trackerA.invalidate(); pending = null; } // page: clear pending + remount (cleanup invalidates, revokes preview)
  check('M-2: deleting the active result requests a Palm reset', reset1);
  // open/create B (new mount)
  const b = activeFromNewAnalysis(analyzeB(), inputB);
  const trackerB = new PalmAttemptTracker();
  saveActive(b);
  // late A response arrives
  const lateApplies = trackerA.isCurrent(inflightA, refA) || trackerB.isCurrent(inflightA, activeBaseRef(b));
  check('M-2: late response of the deleted result A is discarded (old and new mounts)', !lateApplies);
  if (lateApplies) pending = buildPalmSupplementFor(a, FULL, { id: 'late-A', ...NOW });
  const saveB = saveBaseThenPalm(() => saveActive(b), activeBaseRef(b), pending);
  check('M-2: B stays completely unaffected (no Palm, nothing written for A or B)',
    saveB.base === 'saved' && !saveB.palm.ok && readPalmSupplement(activeBaseRef(b)).status === 'none' && readPalmSupplement(refA).status === 'none'
    && getSavedAnalyses().length === 1 && getSavedAnalyses()[0].kind === 'v2' && (getSavedAnalyses()[0].resultData as AnalysisSnapshot).analysisId === (b.result as AnalysisSnapshot).analysisId);
  check('M-2: even a leftover pending A cannot attach to B', eq(savePendingPalmFor(activeBaseRef(b), buildPalmSupplementFor(a, FULL, { id: 'x', ...NOW })), { ok: false, reason: 'other-result' }));
  // deleting a different (non-active) result must not disturb the active result's Palm
  const c = activeFromNewAnalysis(analyzeA(), inputA);
  saveActive(c);
  addPalm(b, 'b-palm');
  deleteAnalysis(getSavedAnalyses().find((x) => x.kind === 'v2' && x.resultData.analysisId === (c.result as AnalysisSnapshot).analysisId)!.id);
  check('M-2: deleting another result does not reset or delete the active result\'s Palm',
    !shouldResetPalmOnDelete(activeBaseRef(b), activeBaseRef(c)!) && readPalmSupplement(activeBaseRef(b)).status === 'ok');
  // a new attempt on the tracker supersedes an older one
  const t = new PalmAttemptTracker();
  const first = t.begin(refA, '1');
  t.begin(refA, '2');
  check('M-2: newer attempt supersedes older one on the same result', !t.isCurrent(first, refA));
}

// ══ M-3: base save failure is handled before any supplement write ══
{
  reset();
  const keep = activeFromNewAnalysis(analyzeB(), inputB);
  saveActive(keep);
  const before = store['destiny_ai_v1'];
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  const fresh = buildPalmSupplementFor(a, FULL, { id: 'fresh-A', ...NOW })!; // already-paid observation, in memory
  const ls = g.localStorage as { setItem: (k: string, v: string) => void };
  const realSet = ls.setItem;
  ls.setItem = (k: string, v: string) => { if (k === 'destiny_ai_v1') throw new Error('QuotaExceededError'); store[k] = v; };
  const r1 = saveBaseThenPalm(() => saveActive(a), activeBaseRef(a), fresh);
  check('M-3: base save throws → reported as base failed (no exception escapes)', r1.base === 'failed');
  check('M-3: no orphan supplement written when the base failed', !store[PALM_SUPPLEMENT_STORAGE_KEY] && readPalmSupplement(activeBaseRef(a)).status === 'none');
  check('M-3: existing saved results preserved', store['destiny_ai_v1'] === before);
  ls.setItem = realSet;
  const r2 = saveBaseThenPalm(() => saveActive(a), activeBaseRef(a), fresh);
  check('M-3: explicit retry saves base then the SAME in-memory supplement (no new observation needed)',
    r2.base === 'saved' && r2.palm.ok && (() => { const x = readPalmSupplement(activeBaseRef(a)); return x.status === 'ok' && x.supplement.id === 'fresh-A'; })());
  // base ok + supplement storage failure are reported separately
  reset();
  const d = activeFromNewAnalysis(analyzeA(), inputA);
  const sd = buildPalmSupplementFor(d, FULL, { id: 'fresh-D', ...NOW })!;
  ls.setItem = (k: string, v: string) => { if (k === PALM_SUPPLEMENT_STORAGE_KEY) throw new Error('quota'); store[k] = v; };
  const r3 = saveBaseThenPalm(() => saveActive(d), activeBaseRef(d), sd);
  ls.setItem = realSet;
  check('M-3: base saved but supplement storage failed → distinguished', r3.base === 'saved' && eq(r3.palm, { ok: false, reason: 'storage-failed' }) && getSavedAnalyses().length === 1);
}

// ══ Stage 3: server-render smoke of the panel (stored supplement, legacy, none) ══
async function renderSmoke() {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const Panel = (await import('../app/components/PalmSupplementPanel')).default;
  reset();
  const a = activeFromNewAnalysis(analyzeA(), inputA);
  saveActive(a);
  addPalm(a, 'render-A');
  const html = renderToStaticMarkup(React.createElement(Panel, { active: a, storeVersion: 0, onPendingChange: () => {}, onSaved: () => {} }));
  check('render: stored supplement shows title, observations, symbolic reading, overlap section and disclaimer',
    html.includes('손바닥 패턴 분석') && html.includes('관찰된 주요 패턴') && html.includes('상징적 해석') && html.includes('기존 운명 코드와의 교집합')
    && html.includes('손바닥 분석은 AI 기반의 해석적 콘텐츠이며') && html.includes('공유에는 기본 운명 코드 결과만'));
  check('render: no rule ids, provider metadata, JSON or confidence in the markup', !/palm\.symbolic|palm\.comparison|gpt-4|openai-responses|palm-vision|confidence|\{&quot;/.test(html));
  const b = activeFromNewAnalysis(analyzeB(), inputB);
  saveActive(b);
  const htmlB = renderToStaticMarkup(React.createElement(Panel, { active: b, storeVersion: 0, onPendingChange: () => {}, onSaved: () => {} }));
  check('render: result B does not render A\'s Palm supplement', !htmlB.includes('관찰된 주요 패턴') && htmlB.includes('손바닥 패턴 분석'));
}

renderSmoke().then(() => {
  if (failures) {
    console.log(`\nFAIL: ${failures} palm-supplement check(s) failed`);
    process.exit(1);
  }
  console.log('\nPASS: all palm-supplement regression checks');
}).catch((e) => { console.log(`FAIL: unexpected ${(e as Error).stack}`); process.exit(1); });
