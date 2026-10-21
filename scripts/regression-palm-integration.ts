// Palm V2 integration — palm as a fifth intersection source (minimal checks).
//   npx -y tsx scripts/regression-palm-integration.ts
import { analyzeDestiny, TAROT_DATA, type CoreTag } from '../app/lib/analysis';
import { parsePalmReading, palmTraitSupport, PALM_SAFE_INTERPRETATION, type PalmReading } from '../app/lib/palmReading';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failed++;
};

const META = { adapterVersion: 'a', modelRevision: 'm', promptVersion: 'p' };
const area = (traits: CoreTag[], confidence = 'high', interpretation = '전통 손금에서는 꾸준함으로 읽기도 합니다.') => ({
  status: 'observed', observedFeatures: ['선이 길고 선명함'], interpretation, confidence, limitations: [], traitCandidates: traits,
});
const unreadable = { status: 'unreadable', limitations: ['흐림'] };
const reading = (areas: Record<string, unknown>, usability = 'usable'): PalmReading => parsePalmReading({
  version: 2, quality: { usability, summary: '' }, extraction: META,
  areas: { life: unreadable, head: unreadable, heart: unreadable, fate: unreadable, palmShape: unreadable, minorLines: unreadable, ...areas },
});

const ARGS = ['1985-12-01', '', 'ENFP', 'female', 'B', TAROT_DATA[5], undefined, undefined, 'solar', false] as const;
const base = analyzeDestiny(...ARGS);

// 1. no palm → no palm fields leak into the result; intersection exists without palm
check('no photo: no palmReading, intersection without palm', !('palmReading' in base) && !!base.intersection && !base.intersection.palmIncluded);

// 2. palm joins the intersection as a real source
const r = reading({ head: area(['독립적']), heart: area(['독립적', '감성적'], 'medium'), life: area(['체계적'], 'low') });
const withPalm = analyzeDestiny(...ARGS, r);
const sup = palmTraitSupport(r);
check('palm traits: low-confidence area excluded, strongest first', sup.map((s) => s.trait).join() === '독립적,감성적', JSON.stringify(sup));
check('palm source appears in trace claims (palm.coreTags)', (withPalm.trace?.claims ?? []).some((c) => c.target === 'palm.coreTags'));
check('intersection marks palm as included and lists palm evidence',
  !!withPalm.intersection?.palmIncluded
  && [...withPalm.intersection.common, ...withPalm.intersection.complements].some((p) => p.sources.some((s) => s.source === 'palm' && s.detail.includes('두뇌선'))));
check('palm traits merged into coreTags', withPalm.coreTags.includes('독립적') && withPalm.coreTags.includes('감성적'));
check('identity still selected (no invariant error)', !!withPalm.identitySelection && !!withPalm.archetype);
check('excluded palm areas reported (life low, unreadable areas)', withPalm.intersection!.palmExcludedAreas.includes('life') && withPalm.intersection!.palmExcludedAreas.includes('fate'));

// 3. unusable photo → palm does not touch the intersection
const un = reading({}, 'unusable');
const withUnusable = analyzeDestiny(...ARGS, un);
check('unusable photo: coreTags/commonKeywords identical to no-photo result',
  JSON.stringify(withUnusable.coreTags) === JSON.stringify(base.coreTags) && JSON.stringify(withUnusable.commonKeywords) === JSON.stringify(base.commonKeywords));

// 4. forbidden topics are neutralised, not shown as facts
const risky = reading({ life: area(['체계적'], 'high', '생명선이 짧아 수명이 짧다고 봅니다.') });
check('lifespan/health claims replaced and trait dropped',
  risky.areas.life.status === 'observed' && risky.areas.life.interpretation === PALM_SAFE_INTERPRETATION && risky.areas.life.traitCandidates.length === 0);

// 5. saved snapshot round-trip keeps the reading (no photo data)
const json = JSON.parse(JSON.stringify(withPalm));
check('snapshot round-trip keeps palmReading and intersection, no image data', !!json.palmReading && !!json.intersection && !/data:image|base64/.test(JSON.stringify(json)));

console.log(failed ? `\nFAIL: ${failed} palm-integration check(s) failed` : '\nPASS: all palm-integration regression checks');
process.exit(failed ? 1 : 0);
