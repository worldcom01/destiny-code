import type { CoreTag } from './analysis';
import { traitSupportInConvergenceScope } from './analysisPatterns';
import type { AnalysisTrace } from './evidenceTrace';
import { PALM_AREA_KEYS, PALM_TRAIT_VOCAB, type PalmAreaKey, type PalmReading } from './palmReading';

// ── 통합 교집합 모델 (intersection-1) ─────────────────────────────────────────
// trace의 교집합 범위(사주·MBTI·혈액형·별자리/점성술·손금)에서 CoreTag별로 어느 소스가 지지하는지 모은다.
// CoreTag는 각 소스의 해석이 가리키는 의미 단위다 — 문자열 일치가 아니라 같은 의미 후보끼리 비교한다.
// common:     2개 이상 소스가 같은 의미를 가리킴 (교집합 패턴)
// complement: 한 소스에서만 나타난 의미 — 다른 소스가 보지 못한 면을 보완
// tension:    서로 다른 방향의 의미 쌍(TENSION_PAIRS)이 각각 다른 소스에서 나타남 (함께 존재할 수 있는 다른 방향)
// 계산만 하고 기존 commonKeywords·Identity를 바꾸지 않는다. 결정적이다(시간·난수 없음).

export const SOURCE_LABELS: Record<string, string> = {
  saju: '사주',
  'western-astrology': '별자리·점성술',
  mbti: 'MBTI',
  'blood-type': '혈액형',
  palm: '손금',
};
const SOURCE_ORDER = ['saju', 'western-astrology', 'mbti', 'blood-type', 'palm'];

export type IntersectionSource = { source: string; label: string; detail: string };

// 같은 사람 안에서 함께 있을 수 있지만 방향이 다른 의미 쌍 (순서 없음)
export const TENSION_PAIRS: ReadonlyArray<readonly [CoreTag, CoreTag]> = [
  ['분석적', '감성적'],
  ['창의적', '체계적'],
  ['독립적', '사교적'],
  ['직관적', '실용적'],
];
export type IntersectionPattern = { trait: CoreTag; sources: IntersectionSource[] };
export type IntersectionTension = { traits: [CoreTag, CoreTag]; sides: [IntersectionSource[], IntersectionSource[]] };

export type IntersectionModel = {
  version: 1;
  palmIncluded: boolean;
  sourceCount: number;
  common: IntersectionPattern[];
  complements: IntersectionPattern[];
  tensions: IntersectionTension[];
  palmExcludedAreas: PalmAreaKey[]; // 판독 불가·낮은 신뢰도로 교집합에서 제외된 손금 영역
};

export function buildIntersection(input: {
  trace: AnalysisTrace;
  sourceDetails: Record<string, string>;
  palmDetailByTrait?: Partial<Record<CoreTag, string>>; // 손금은 성향마다 근거 영역이 다르다
  palm?: PalmReading;
}): IntersectionModel {
  const support = traitSupportInConvergenceScope(input.trace);
  const toSources = (sources: string[], trait: CoreTag): IntersectionSource[] =>
    [...sources]
      .sort((a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b))
      .map((s) => ({
        source: s,
        label: SOURCE_LABELS[s] ?? s,
        detail: (s === 'palm' ? input.palmDetailByTrait?.[trait] : undefined) ?? input.sourceDetails[s] ?? '',
      }));
  const vocabOrder = (t: CoreTag) => PALM_TRAIT_VOCAB.indexOf(t);

  const entries = [...support.entries()].map(([trait, s]) => ({ trait, sources: s.sources }));
  const common = entries
    .filter((e) => e.sources.length >= 2)
    .sort((a, b) => b.sources.length - a.sources.length || vocabOrder(a.trait) - vocabOrder(b.trait))
    .map((e) => ({ trait: e.trait, sources: toSources(e.sources, e.trait) }));
  const complements = entries
    .filter((e) => e.sources.length === 1)
    .sort((a, b) => SOURCE_ORDER.indexOf(a.sources[0]) - SOURCE_ORDER.indexOf(b.sources[0]) || vocabOrder(a.trait) - vocabOrder(b.trait))
    .map((e) => ({ trait: e.trait, sources: toSources(e.sources, e.trait) }));

  const tensions: IntersectionTension[] = [];
  for (const [a, b] of TENSION_PAIRS) {
    const sa = support.get(a)?.sources ?? [];
    const sb = support.get(b)?.sources ?? [];
    // 각 방향을 상대 방향에는 없는 소스가 지지할 때만 소스 간 대비로 본다 (한 소스 안의 양면은 제외)
    const onlyA = sa.filter((x) => !sb.includes(x));
    const onlyB = sb.filter((x) => !sa.includes(x));
    if (onlyA.length === 0 || onlyB.length === 0) continue;
    tensions.push({ traits: [a, b], sides: [toSources(onlyA, a), toSources(onlyB, b)] });
  }

  const allSources = new Set(entries.flatMap((e) => e.sources));
  const palm = input.palm;
  const palmExcludedAreas = palm
    ? PALM_AREA_KEYS.filter((k) => {
        const area = palm.areas[k];
        return area.status !== 'observed' || area.confidence === 'low' || area.traitCandidates.length === 0;
      })
    : [];

  return {
    version: 1,
    palmIncluded: allSources.has('palm'),
    sourceCount: allSources.size,
    common,
    complements,
    tensions,
    palmExcludedAreas,
  };
}
