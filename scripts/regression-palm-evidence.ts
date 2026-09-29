// Regression checks for Palm Phase 1A — observation contract + evidence adapter.
//
//   npx -y tsx scripts/regression-palm-evidence.ts
//
// PalmObservationBundle → EvidenceRecord[] only. No image, provider, claims, CoreTags,
// engine integration or storage in this phase (docs/ai/CODEX_REVIEW.md "Palm Phase 1").

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeDestiny, TAROT_DATA, IDENTITY_PAIR_DEFINITIONS, ANALYSIS_ENGINE_VERSION } from '../app/lib/analysis';
import type { EvidenceRecord } from '../app/lib/evidenceTrace';
import { deriveAnalysisPatterns, traitSupportInConvergenceScope } from '../app/lib/analysisPatterns';
import * as palmEvidenceModule from '../app/lib/palmEvidence';
import { buildPalmEvidence } from '../app/lib/palmEvidence';
import {
  parsePalmObservationBundle, PalmObservationContractError,
  type PalmLineKey, type PalmLineObservation, type PalmObservationBundle, type PalmImageQuality,
} from '../app/lib/palmObservation';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`);
  if (!ok) failures++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── fixtures ──
const visible = (curvature: 'straight' | 'curved' | null, continuity: 'continuous' | 'interrupted' | null): PalmLineObservation => ({
  status: 'visible',
  curvature: curvature ? { status: 'observed', value: curvature } : { status: 'unreadable', reason: 'ambiguous-line' },
  continuity: continuity ? { status: 'observed', value: continuity } : { status: 'unreadable', reason: 'cropped' },
});
const UNREADABLE: PalmLineObservation = { status: 'unreadable', reason: 'blur' };
const NOT_DETECTED: PalmLineObservation = { status: 'not-detected' };
const QUALITY = (usability: PalmImageQuality['usability'], issues: PalmImageQuality['issues'] = []): PalmImageQuality =>
  ({ version: 1, usability, palmCoverage: usability === 'unusable' ? 'none' : usability === 'partial' ? 'partial' : 'full', issues });
const bundle = (lines: Record<PalmLineKey, PalmLineObservation>, quality: PalmImageQuality): PalmObservationBundle => ({
  version: 1,
  observation: { version: 1, lines },
  quality,
  extraction: { adapterVersion: 'fixture-1', modelRevision: 'fixture', promptVersion: 'fixture-1' },
});
const deepFreeze = <T,>(o: T): T => {
  if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
  return o;
};
const rows = (ev: EvidenceRecord[]) => ev.map((e) => `${e.id}=${e.value}/${e.status}`);

const EXPECTED_IDS = (['life', 'head', 'heart', 'fate'] as const)
  .flatMap((k) => ['visibility', 'curvature', 'continuity'].map((a) => `palm:line:${k}:${a}`));

const COMPLETE = bundle({
  life: visible('curved', 'continuous'),
  head: visible('straight', 'continuous'),
  heart: visible('curved', 'interrupted'),
  fate: visible('straight', 'interrupted'),
}, QUALITY('usable'));

// 1. complete readable observation
{
  const ev = buildPalmEvidence(COMPLETE);
  check('1 complete: 12 records, all available', ev.length === 12 && ev.every((e) => e.status === 'available'));
  check('1 complete: values are the observed enums', eq(ev.map((e) => e.value), [
    'visible', 'curved', 'continuous', 'visible', 'straight', 'continuous',
    'visible', 'curved', 'interrupted', 'visible', 'straight', 'interrupted',
  ]));
}

// 6 / 7. deterministic ids and ordering
{
  const ev = buildPalmEvidence(COMPLETE);
  check('6 ids follow palm:line:<key>:<attribute>', eq(ev.map((e) => e.id), EXPECTED_IDS));
  check('6 ids are unique', new Set(ev.map((e) => e.id)).size === ev.length);
  check('7 order is life, head, heart, fate × visibility, curvature, continuity',
    eq(ev.map((e) => e.feature), EXPECTED_IDS.map((id) => id.replace('palm:line:', 'line.').replace(/:/g, '.'))));
  // key order of the input object must not change the output order
  const shuffled = bundle({ fate: COMPLETE.observation.lines.fate, heart: COMPLETE.observation.lines.heart,
    head: COMPLETE.observation.lines.head, life: COMPLETE.observation.lines.life }, QUALITY('usable'));
  check('7 input key order does not change output order', eq(buildPalmEvidence(shuffled), ev));
}

// 2. partially readable observation
{
  const ev = buildPalmEvidence(bundle({
    life: visible('curved', null),
    head: visible(null, 'continuous'),
    heart: UNREADABLE,
    fate: NOT_DETECTED,
  }, QUALITY('partial', ['cropped-palm'])));
  check('2 partial: only read attributes are available', eq(rows(ev), [
    'palm:line:life:visibility=visible/available', 'palm:line:life:curvature=curved/available', 'palm:line:life:continuity=null/unreadable',
    'palm:line:head:visibility=visible/available', 'palm:line:head:curvature=null/unreadable', 'palm:line:head:continuity=continuous/available',
    'palm:line:heart:visibility=null/unreadable', 'palm:line:heart:curvature=null/unreadable', 'palm:line:heart:continuity=null/unreadable',
    'palm:line:fate:visibility=not-detected/available', 'palm:line:fate:curvature=null/missing', 'palm:line:fate:continuity=null/missing',
  ]), JSON.stringify(rows(ev)));
}

// 3. fully unusable observation → no Palm evidence at all
{
  const allUnreadable = { life: UNREADABLE, head: UNREADABLE, heart: UNREADABLE, fate: UNREADABLE };
  check('3 unusable quality → 0 records', buildPalmEvidence(bundle(allUnreadable, QUALITY('unusable', ['not-a-palm']))).length === 0);
  let err: unknown = null;
  try { buildPalmEvidence(bundle(COMPLETE.observation.lines, QUALITY('unusable', ['not-a-palm']))); } catch (e) { err = e; }
  check('3 unusable quality with observed lines is a contradiction → rejected (design §3)', err instanceof PalmObservationContractError);
}

// 4. one readable line + three unreadable lines
{
  const ev = buildPalmEvidence(bundle({ life: UNREADABLE, head: visible('curved', 'continuous'), heart: UNREADABLE, fate: UNREADABLE }, QUALITY('partial', ['blur'])));
  const available = ev.filter((e) => e.status === 'available').map((e) => e.id);
  check('4 one readable line: only its three records are available',
    ev.length === 12 && eq(available, ['palm:line:head:visibility', 'palm:line:head:curvature', 'palm:line:head:continuity']));
  check('4 unreadable lines: visibility and both attributes unreadable/null',
    ev.filter((e) => !e.id.includes(':head:')).every((e) => e.status === 'unreadable' && e.value === null));
}

// 5 / 12. missing / unavailable data
{
  check('5 no bundle (no image) → 0 records; no fabricated missing rows', buildPalmEvidence(undefined).length === 0);
  const ev = buildPalmEvidence(bundle({ life: NOT_DETECTED, head: NOT_DETECTED, heart: NOT_DETECTED, fate: NOT_DETECTED }, QUALITY('usable')));
  check('5 not-detected is an observation (available), attributes are missing',
    ev.filter((e) => e.feature.endsWith('visibility')).every((e) => e.status === 'available' && e.value === 'not-detected')
    && ev.filter((e) => !e.feature.endsWith('visibility')).every((e) => e.status === 'missing'));
  check('12 missing never carries an observed value', ev.filter((e) => e.status === 'missing').every((e) => e.value === null));
}

// 11. unreadable never becomes an observed value / not-detected
{
  const ev = buildPalmEvidence(bundle({ life: UNREADABLE, head: visible(null, null), heart: UNREADABLE, fate: visible(null, null) }, QUALITY('partial', ['lighting'])));
  const unreadable = ev.filter((e) => e.status === 'unreadable');
  check('11 unreadable records have null value (no default, not "not-detected")',
    unreadable.length === 10 && unreadable.every((e) => e.value === null));
  check('11 unreadable line is not converted into not-detected / missing',
    ev.filter((e) => e.id.startsWith('palm:line:life:')).every((e) => e.status === 'unreadable'));
}

// 8 / 15. input non-mutation and repeatability
{
  const input = deepFreeze(JSON.parse(JSON.stringify(COMPLETE)) as PalmObservationBundle);
  const before = JSON.stringify(input);
  let threw = false;
  let a: EvidenceRecord[] = [], b: EvidenceRecord[] = [];
  try { a = buildPalmEvidence(input); b = buildPalmEvidence(input); } catch { threw = true; }
  check('8 deep-frozen input converts without mutation', !threw && JSON.stringify(input) === before);
  check('15 repeated conversion is identical', eq(a, b) && a !== b && a[0] !== b[0]);
  const realRandom = Math.random, realNow = Date.now;
  let touched = false;
  Math.random = () => { touched = true; return 0.5; };
  Date.now = () => { touched = true; return 0; };
  const c = buildPalmEvidence(COMPLETE);
  Math.random = realRandom; Date.now = realNow;
  check('15 no Math.random / Date.now during conversion', !touched && eq(c, a));
}

// 9 / 10 / 17. EvidenceRecord contract
{
  const all = [
    ...buildPalmEvidence(COMPLETE),
    ...buildPalmEvidence(bundle({ life: UNREADABLE, head: NOT_DETECTED, heart: visible(null, 'continuous'), fate: visible('curved', null) }, QUALITY('partial'))),
  ];
  check('9 source is "palm"', all.every((e) => e.source === 'palm'));
  check('10 kind is "image-observation"', all.every((e) => e.kind === 'image-observation'));
  check('17 exactly the EvidenceRecord fields', all.every((e) => eq(Object.keys(e), ['id', 'source', 'kind', 'feature', 'value', 'status'])));
  check('17 value is a string or null, status in the existing union',
    all.every((e) => (typeof e.value === 'string' || e.value === null) && ['available', 'missing', 'unreadable'].includes(e.status)));
  check('17 available ⇔ non-null value', all.every((e) => (e.status === 'available') === (e.value !== null)));
}

// 13 / 14. no claims, no CoreTag mapping
{
  const ev = buildPalmEvidence(COMPLETE);
  check('13 adapter output contains no claim fields (trait / ruleId / evidenceIds)',
    ev.every((e) => !('trait' in e) && !('ruleId' in e) && !('evidenceIds' in e)));
  check('13/14 palmEvidence exports only the adapter', eq(Object.keys(palmEvidenceModule), ['buildPalmEvidence']));
  const CORE_TAGS = ['창의적', '분석적', '감성적', '실용적', '사교적', '독립적', '직관적', '체계적', '열정적', '포용적'];
  // code only — the modules' comments state that they create no CoreTag / claim
  const sources = ['app/lib/palmObservation.ts', 'app/lib/palmEvidence.ts']
    .map((f) => readFileSync(join(__dirname, '..', f), 'utf8').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n'));
  check('14 Palm module code references no CoreTag, no CoreTag value, no claim type',
    sources.every((src) => !/CoreTag|InterpretationClaim|coreTags/.test(src) && CORE_TAGS.every((t) => !src.includes(t))));
  // Palm evidence next to a real trace: with no Palm claims, patterns and support are unchanged
  const s = analyzeDestiny('1985-12-01', '', 'ENFP', 'female', 'B', TAROT_DATA[5]);
  const withPalm = { ...s.trace!, evidence: [...s.trace!.evidence, ...ev] };
  check('13 appending Palm evidence to a trace changes no pattern or support (0 Palm claims)',
    eq(deriveAnalysisPatterns(withPalm, IDENTITY_PAIR_DEFINITIONS), deriveAnalysisPatterns(s.trace!, IDENTITY_PAIR_DEFINITIONS))
    && eq([...traitSupportInConvergenceScope(withPalm)], [...traitSupportInConvergenceScope(s.trace!)]));
  check('13 production analysis has no Palm evidence or claims (not integrated in Phase 1A)',
    !s.trace!.evidence.some((e) => e.source === 'palm') && !s.trace!.claims.some((c) => c.id.startsWith('palm'))
    && !('palm' in s) && ANALYSIS_ENGINE_VERSION === '3' && s.schemaVersion === 2);
}

// 16. quality / readability separation
{
  const lines = { life: visible('curved', null), head: NOT_DETECTED, heart: UNREADABLE, fate: visible('straight', 'continuous') } as const;
  const a = buildPalmEvidence(bundle({ ...lines }, QUALITY('usable')));
  const b = buildPalmEvidence(bundle({ ...lines }, QUALITY('partial', ['blur', 'lighting', 'perspective'])));
  check('16 quality issues/coverage do not change evidence of a usable/partial image', eq(a, b));
  check('16 no quality metadata becomes evidence',
    a.every((e) => e.feature.startsWith('line.')) && !JSON.stringify(a).match(/usab|coverage|blur|lighting|perspective|occlu|cropped|fixture/));
  check('16 good image quality does not turn an unreadable attribute into a value',
    a.find((e) => e.id === 'palm:line:life:continuity')?.status === 'unreadable');
}

// 18. malformed internal input is rejected (fail closed, no partial output)
{
  const L = COMPLETE.observation.lines;
  const cases: Array<[string, unknown]> = [
    ['not an object', 'palm'],
    ['bundle version', { ...COMPLETE, version: 2 }],
    ['observation version', { ...COMPLETE, observation: { version: 2, lines: L } }],
    ['quality missing', { ...COMPLETE, quality: undefined }],
    ['invalid usability', { ...COMPLETE, quality: { ...COMPLETE.quality, usability: 'great' } }],
    ['missing line key', { ...COMPLETE, observation: { version: 1, lines: { life: L.life, head: L.head, heart: L.heart } } }],
    ['unknown line key', { ...COMPLETE, observation: { version: 1, lines: { ...L, marriage: L.life } } }],
    ['invalid line status', { ...COMPLETE, observation: { version: 1, lines: { ...L, life: { status: 'absent' } } } }],
    ['invalid curvature value', { ...COMPLETE, observation: { version: 1, lines: { ...L, head: { status: 'visible', curvature: { status: 'observed', value: 'wavy' }, continuity: { status: 'observed', value: 'continuous' } } } } }],
    ['observed without value', { ...COMPLETE, observation: { version: 1, lines: { ...L, head: { status: 'visible', curvature: { status: 'observed' }, continuity: { status: 'observed', value: 'continuous' } } } } }],
    ['invalid unreadable reason', { ...COMPLETE, observation: { version: 1, lines: { ...L, fate: { status: 'unreadable', reason: 'model-unsure' } } } }],
    ['not-detected with attributes', { ...COMPLETE, observation: { version: 1, lines: { ...L, fate: { status: 'not-detected', curvature: { status: 'observed', value: 'curved' } } } } }],
    ['visible without readings', { ...COMPLETE, observation: { version: 1, lines: { ...L, life: { status: 'visible' } } } }],
  ];
  for (const [name, input] of cases) {
    let err: unknown = null;
    let out: unknown = undefined;
    try { out = buildPalmEvidence(input as PalmObservationBundle); } catch (e) { err = e; }
    check(`18 malformed (${name}) → PalmObservationContractError, no output`, err instanceof PalmObservationContractError && out === undefined);
  }
}


// ── Codex Phase 1A IMPORTANT: one shared runtime validation boundary ──
const VALID_UNKNOWN: unknown = JSON.parse(JSON.stringify(bundle({
  life: visible('curved', null), head: NOT_DETECTED, heart: UNREADABLE, fate: visible('straight', 'continuous'),
}, QUALITY('partial', ['cropped-palm']))));
const withLine = (key: PalmLineKey, line: unknown): unknown => {
  const b = JSON.parse(JSON.stringify(VALID_UNKNOWN));
  b.observation.lines[key] = line;
  return b;
};
const OBS = { status: 'observed', value: 'curved' };
const OBS_CONT = { status: 'observed', value: 'continuous' };
const ADVERSARIAL: Array<[string, unknown]> = [
  ['1 unreadable reading + observed value', withLine('life', { status: 'visible', curvature: { status: 'unreadable', reason: 'blur', value: 'curved' }, continuity: OBS_CONT })],
  ['2 observed reading + unreadable reason', withLine('life', { status: 'visible', curvature: { status: 'observed', value: 'curved', reason: 'blur' }, continuity: OBS_CONT })],
  ['3 unreadable line + observed curvature', withLine('heart', { status: 'unreadable', reason: 'blur', curvature: OBS })],
  ['4 unreadable line + observed continuity', withLine('heart', { status: 'unreadable', reason: 'blur', continuity: OBS_CONT })],
  ['5 not-detected line + observed curvature', withLine('head', { status: 'not-detected', curvature: OBS })],
  ['6 not-detected line + observed continuity', withLine('head', { status: 'not-detected', continuity: OBS_CONT })],
  ['7 visible line missing a required reading', withLine('fate', { status: 'visible', curvature: OBS })],
  ['8 unsupported curvature value', withLine('fate', { status: 'visible', curvature: { status: 'observed', value: 'wavy' }, continuity: OBS_CONT })],
  ['9 unsupported continuity value', withLine('fate', { status: 'visible', curvature: OBS, continuity: { status: 'observed', value: 'broken-ish' } })],
  ['10 unsupported unreadable reason', withLine('heart', { status: 'unreadable', reason: 'model-unsure' })],
  ['11 malformed quality usability', (() => { const b = JSON.parse(JSON.stringify(VALID_UNKNOWN)); b.quality.usability = 'good'; return b; })()],
  ['12 malformed nested line structure', withLine('life', ['visible', 'curved'])],
  ['visible line + unreadable-line reason', withLine('life', { status: 'visible', reason: 'blur', curvature: OBS, continuity: OBS_CONT })],
  ['not-detected line + reason', withLine('head', { status: 'not-detected', reason: 'blur' })],
  ['reading without status', withLine('life', { status: 'visible', curvature: { value: 'curved' }, continuity: OBS_CONT })],
  ['observed reading without value', withLine('life', { status: 'visible', curvature: { status: 'observed' }, continuity: OBS_CONT })],
  ['unreadable line without reason', withLine('heart', { status: 'unreadable' })],
  ['quality palmCoverage invalid', (() => { const b = JSON.parse(JSON.stringify(VALID_UNKNOWN)); b.quality.palmCoverage = 'most'; return b; })()],
  ['quality issue invalid', (() => { const b = JSON.parse(JSON.stringify(VALID_UNKNOWN)); b.quality.issues = ['cosmic-rays']; return b; })()],
  ['quality issues duplicated', (() => { const b = JSON.parse(JSON.stringify(VALID_UNKNOWN)); b.quality.issues = ['blur', 'blur']; return b; })()],
  ['quality extra field (numeric confidence)', (() => { const b = JSON.parse(JSON.stringify(VALID_UNKNOWN)); b.quality.confidence = 0.82; return b; })()],
  ['no palm coverage but usable', (() => { const b = JSON.parse(JSON.stringify(VALID_UNKNOWN)); b.quality.palmCoverage = 'none'; return b; })()],
  ['extraction version empty', (() => { const b = JSON.parse(JSON.stringify(VALID_UNKNOWN)); b.extraction.modelRevision = ''; return b; })()],
  ['bundle extra field', (() => { const b = JSON.parse(JSON.stringify(VALID_UNKNOWN)); b.coreTags = ['창의적']; return b; })()],
];
for (const [name, input] of ADVERSARIAL) {
  const before = JSON.stringify(input);
  let direct: unknown = null, viaAdapter: unknown = null;
  let out: unknown = undefined;
  try { parsePalmObservationBundle(input); } catch (e) { direct = e; }
  try { out = buildPalmEvidence(input as PalmObservationBundle); } catch (e) { viaAdapter = e; }
  check(`adversarial ${name}: validator and adapter both reject, 0 evidence, input untouched`,
    direct instanceof PalmObservationContractError && viaAdapter instanceof PalmObservationContractError
    && out === undefined && JSON.stringify(input) === before);
}

// atomic rejection: valid life/head/heart + malformed fate → no rows at all
{
  const input = withLine('fate', { status: 'unreadable', reason: 'blur', continuity: OBS_CONT });
  let rows: EvidenceRecord[] | undefined;
  let err: unknown = null;
  try { rows = buildPalmEvidence(input as PalmObservationBundle); } catch (e) { err = e; }
  check('atomic: one malformed line (fate) → error and zero rows from the valid lines', err instanceof PalmObservationContractError && rows === undefined);
}

// public validator: valid input, non-mutation, fresh output, determinism
{
  const frozen = deepFreeze(JSON.parse(JSON.stringify(VALID_UNKNOWN)));
  const before = JSON.stringify(frozen);
  const a = parsePalmObservationBundle(frozen);
  const b = parsePalmObservationBundle(frozen);
  check('validator accepts a valid unknown bundle and returns an equal value', eq(a, frozen));
  check('validator does not mutate (deep-frozen input) and returns a fresh object', JSON.stringify(frozen) === before && a !== frozen && a.observation !== (frozen as PalmObservationBundle).observation);
  check('validator is deterministic', eq(a, b));
  check('validated bundle converts to the same evidence as the original', eq(buildPalmEvidence(a), buildPalmEvidence(frozen as PalmObservationBundle)));
}

// future Phase 1B boundary shape: untrusted provider output → validator → adapter
{
  const providerOutput: unknown = JSON.parse(JSON.stringify(VALID_UNKNOWN));
  const validated = parsePalmObservationBundle(providerOutput);
  const ev = buildPalmEvidence(validated);
  check('provider-style unknown → parsePalmObservationBundle → buildPalmEvidence (12 rows)',
    ev.length === 12 && ev.every((e) => e.source === 'palm' && e.kind === 'image-observation'));
  const malformed: unknown = withLine('heart', { status: 'unreadable', reason: 'blur', curvature: OBS });
  let err: unknown = null;
  let reachedAdapter = false;
  try {
    const v = parsePalmObservationBundle(malformed);
    reachedAdapter = true;
    buildPalmEvidence(v);
  } catch (e) { err = e; }
  check('malformed provider output is rejected before any adapter output exists', err instanceof PalmObservationContractError && !reachedAdapter);
}

if (failures) {
  console.log(`\nFAIL: ${failures} palm-evidence check(s) failed`);
  process.exit(1);
}
console.log('\nPASS: all palm-evidence regression checks');
