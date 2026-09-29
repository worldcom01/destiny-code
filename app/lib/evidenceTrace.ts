import type {
  BloodTypeResult,
  CoreTag,
  ElementKey,
  MbtiResult,
  SajuOutput,
  TarotResult,
  ZodiacResult,
} from './analysis';
import type { WesternAstrologyResult, WesternPlacement, ZodiacKey } from './westernAstrology';

// ── Phase 2A: 기존 CoreTag의 출처 추적 ─────────────────────────────────────
// trace는 이미 계산된 분석 결과를 설명하는 기록일 뿐이다.
// 기존 태그·충돌·키워드 강도·서술을 구동하거나 대체하지 않는다.
// engine v2부터 Identity 선택(identitySelection.ts)만 trace에서 파생한 패턴을 사용한다.
// 계산을 다시 실행하지 않고, 난수·시간·I/O를 사용하지 않는다.

export type EvidenceRecord = {
  id: string;
  source: string;
  kind: 'self-report' | 'calculated' | 'symbolic' | 'image-observation';
  feature: string;
  value: string | number | boolean | null;
  status: 'available' | 'missing' | 'unreadable';
};

export type InterpretationClaim = {
  id: string;
  trait: CoreTag;
  evidenceIds: string[];
  ruleId: string;
  basis: 'type-mapping' | 'symbolic';
  target: string;
};

export type AnalysisTrace = {
  version: 1;
  evidence: EvidenceRecord[];
  claims: InterpretationClaim[];
};

export interface AnalysisTraceInput {
  saju: SajuOutput;
  zodiacKey: ZodiacKey;
  zodiac: ZodiacResult;
  westernAstrology: WesternAstrologyResult;
  mbti: MbtiResult;
  bloodType: BloodTypeResult;
  tarot: TarotResult;
  // analysis.ts의 ELEMENT_CORE_TAGS — 복제하지 않고 참조로 받는다
  elementCoreTags: Readonly<Record<ElementKey, readonly CoreTag[]>>;
}

type ClaimRule = Pick<InterpretationClaim, 'ruleId' | 'basis' | 'target'>;

// tags 순서대로 Claim 생성. 같은 경로 안의 중복 태그는 한 번만 기록한다.
function claimsFor(
  idPrefix: string,
  tags: readonly CoreTag[],
  evidenceId: string,
  rule: ClaimRule,
): InterpretationClaim[] {
  return tags
    .filter((t, i) => tags.indexOf(t) === i)
    .map((trait) => ({ id: `${idPrefix}:${trait}`, trait, evidenceIds: [evidenceId], ...rule }));
}

function traceSaju(saju: SajuOutput, elementCoreTags: AnalysisTraceInput['elementCoreTags']) {
  const evidence: EvidenceRecord[] = [];
  const claims: InterpretationClaim[] = [];
  const target = 'saju.coreTags';

  const dominantId = 'saju:dominant-element';
  evidence.push({ id: dominantId, source: 'saju', kind: 'calculated', feature: 'dominant-element', value: saju.dominantElement, status: 'available' });
  // 최종 saju.coreTags에 남은 태그만 기록한다 (3개 제한으로 빠진 태그 제외)
  const dominantTags = elementCoreTags[saju.dominantElement].filter((t) => saju.coreTags.includes(t));
  claims.push(...claimsFor(dominantId, dominantTags, dominantId,
    { ruleId: 'saju.dominant-element-tags@1', basis: 'symbolic', target }));

  const firstMissing = saju.missingElements[0];
  if (firstMissing) {
    const missingId = 'saju:first-missing-element';
    evidence.push({ id: missingId, source: 'saju', kind: 'calculated', feature: 'first-missing-element', value: firstMissing, status: 'available' });
    const compensationTags = elementCoreTags[firstMissing].filter((t) => saju.coreTags.includes(t));
    claims.push(...claimsFor(missingId, compensationTags, missingId,
      { ruleId: 'saju.missing-element-compensation@1', basis: 'symbolic', target }));
  }

  // 계산 맥락 — 태그의 직접 근거로 연결하지 않는다
  evidence.push({ id: 'saju:birth-time-provided', source: 'saju', kind: 'self-report', feature: 'birth-time-provided', value: saju.hasTime, status: 'available' });
  if (!saju.hasTime) {
    evidence.push({ id: 'saju:calculation-time-default', source: 'saju', kind: 'calculated', feature: 'calculation-time-default', value: '12:00', status: 'available' });
  }

  return { evidence, claims };
}

function traceMbti(mbti: MbtiResult) {
  const id = 'mbti:type';
  const evidence: EvidenceRecord[] = [mbti.type
    ? { id, source: 'mbti', kind: 'self-report', feature: 'type', value: mbti.type, status: 'available' }
    : { id, source: 'mbti', kind: 'self-report', feature: 'type', value: null, status: 'missing' }];
  const claims = mbti.type
    ? claimsFor(id, mbti.coreTags, id, { ruleId: 'mbti.type-tags@1', basis: 'type-mapping', target: 'mbtiTraits.coreTags' })
    : [];
  return { evidence, claims };
}

function traceBloodType(bloodType: BloodTypeResult) {
  const id = 'blood-type:type';
  const evidence: EvidenceRecord[] = [
    { id, source: 'blood-type', kind: 'self-report', feature: 'type', value: bloodType.type, status: 'available' },
  ];
  const claims = claimsFor(id, bloodType.coreTags, id,
    { ruleId: 'blood-type.symbolic-tags@1', basis: 'symbolic', target: 'bloodType.coreTags' });
  return { evidence, claims };
}

function traceWesternAstrology(zodiacKey: ZodiacKey, zodiac: ZodiacResult, wa: WesternAstrologyResult) {
  const evidence: EvidenceRecord[] = [];
  const claims: InterpretationClaim[] = [];
  const source = 'western-astrology';

  const sunId = 'western-astrology:sun-sign';
  evidence.push({ id: sunId, source, kind: 'calculated', feature: 'sun-sign', value: wa.sun.signKey, status: 'available' });

  // 기존 zodiac 경로. 태양궁 Evidence를 공유하되, 두 경로의 키가 다르면 합치지 않고 따로 기록한다.
  let zodiacEvidenceId = sunId;
  if (zodiacKey !== wa.sun.signKey) {
    zodiacEvidenceId = 'western-astrology:zodiac-sign';
    evidence.push({ id: zodiacEvidenceId, source, kind: 'calculated', feature: 'zodiac-sign', value: zodiacKey, status: 'available' });
  }
  claims.push(...claimsFor('zodiac:sun-sign', zodiac.coreTags, zodiacEvidenceId,
    { ruleId: 'zodiac.sign-tags@1', basis: 'symbolic', target: 'zodiac.coreTags' }));

  const placementRule = 'western-astrology.placement-tags@1';
  claims.push(...claimsFor(sunId, wa.sun.data.coreTags, sunId,
    { ruleId: placementRule, basis: 'symbolic', target: 'westernAstrology.sun.data.coreTags' }));

  const optional: Array<[string, WesternPlacement | null]> = [['moon', wa.moon], ['ascendant', wa.ascendant]];
  for (const [name, placement] of optional) {
    const id = `western-astrology:${name}-sign`;
    if (!placement) {
      evidence.push({ id, source, kind: 'calculated', feature: `${name}-sign`, value: null, status: 'missing' });
      continue;
    }
    evidence.push({ id, source, kind: 'calculated', feature: `${name}-sign`, value: placement.signKey, status: 'available' });
    claims.push(...claimsFor(id, placement.data.coreTags, id,
      { ruleId: placementRule, basis: 'symbolic', target: `westernAstrology.${name}.data.coreTags` }));
  }

  // 기존 값 그대로 기록한다 (현재는 시간이 있어 달·상승궁을 근사 계산했을 때 true)
  evidence.push({ id: 'western-astrology:is-approximate', source, kind: 'calculated', feature: 'is-approximate', value: wa.isApproximate, status: 'available' });

  return { evidence, claims };
}

function traceTarot(tarot: TarotResult) {
  const id = 'tarot:card-number';
  const evidence: EvidenceRecord[] = [
    { id, source: 'tarot', kind: 'symbolic', feature: 'card-number', value: tarot.number, status: 'available' },
  ];
  const claims = claimsFor(id, tarot.coreTags, id,
    { ruleId: 'tarot.card-tags@1', basis: 'symbolic', target: 'tarot.coreTags' });
  return { evidence, claims };
}

export function buildAnalysisTrace(input: AnalysisTraceInput): AnalysisTrace {
  const parts = [
    traceSaju(input.saju, input.elementCoreTags),
    traceMbti(input.mbti),
    traceBloodType(input.bloodType),
    traceWesternAstrology(input.zodiacKey, input.zodiac, input.westernAstrology),
    traceTarot(input.tarot),
  ];
  return {
    version: 1,
    evidence: parts.flatMap((p) => p.evidence),
    claims: parts.flatMap((p) => p.claims),
  };
}
