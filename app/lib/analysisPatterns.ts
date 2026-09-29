import type { CoreTag } from './analysis';
import type { AnalysisTrace, InterpretationClaim } from './evidenceTrace';

// ── Phase 2B 기반: AnalysisTrace에서 파생하는 패턴 ──────────────────────────
// coreTags·교집합·서술·UI를 구동하지 않는다. 패턴 자체는 저장하지 않는다.
// engine v2부터 Identity 선택(identitySelection.ts)만 이 패턴과 convergence 범위 지지를 사용한다.
// 같은 trace에서 항상 같은 결과가 나온다. 점수·가중치·신뢰도를 두지 않는다.
// convergence는 상징 매핑들이 겹친다는 서술이지, 성향이 검증되었다는 뜻이 아니다 (AD-004).

export type ConvergencePattern = {
  kind: 'convergence';
  trait: CoreTag;
  sources: string[];      // 이 태그를 지지하는 서로 다른 source (2개 이상)
  evidenceIds: string[];  // 서로 다른 Evidence — 같은 Evidence를 공유하는 경로는 한 번만
  claimIds: string[];
};

export type PairSideSupport = {
  claimIds: string[];
  sources: string[];
};

export type AuthoredPairPattern = {
  kind: 'authored-pair';
  ruleId: 'identity.conflict-pair@1';
  pairIndex: number;      // IDENTITY_PAIR_DEFINITIONS 안의 위치 (중복 쌍도 그대로 구분)
  traits: [CoreTag, CoreTag];
  support: [PairSideSupport, PairSideSupport];
  sharedSources: string[]; // 두 태그를 모두 지지하는 source. 비어 있으면 서로 다른 소스 간 공존
};

export type AnalysisPattern = ConvergencePattern | AuthoredPairPattern;

// 교집합(calcCommonKeywords)이 보는 소스: 사주·MBTI·혈액형·서양 점성술(태양·달·상승 + 같은 태양궁의 zodiac 경로).
// 타로는 merged coreTags·교집합·Identity에 참여하지 않으므로 제외한다.
const CONVERGENCE_TARGETS: ReadonlySet<string> = new Set([
  'saju.coreTags',
  'mbtiTraits.coreTags',
  'bloodType.coreTags',
  'zodiac.coreTags',
  'westernAstrology.sun.data.coreTags',
  'westernAstrology.moon.data.coreTags',
  'westernAstrology.ascendant.data.coreTags',
]);

// generateIdentity()의 태그 합집합과 같은 범위: 사주·zodiac(태양)·혈액형·MBTI.
const IDENTITY_TARGETS: ReadonlySet<string> = new Set([
  'saju.coreTags',
  'zodiac.coreTags',
  'bloodType.coreTags',
  'mbtiTraits.coreTags',
]);

const unique = <T,>(xs: T[]): T[] => xs.filter((x, i) => xs.indexOf(x) === i);

export type TraitSupport = {
  claimIds: string[];
  sources: string[];
  evidenceIds: string[];
};

// available Evidence에 연결된 Claim과 그 source 조회
function supportedClaims(trace: AnalysisTrace) {
  const sourceOf = new Map<string, string>();
  for (const e of trace.evidence) {
    if (e.status === 'available') sourceOf.set(e.id, e.source);
  }
  // 사용 가능한 Evidence가 없는 Claim은 근거로 쓰지 않는다
  const supported = trace.claims.filter((c) =>
    c.evidenceIds.length > 0 && c.evidenceIds.every((id) => sourceOf.has(id)));
  const sourcesOf = (claims: InterpretationClaim[]) =>
    unique(claims.flatMap((c) => c.evidenceIds.map((id) => sourceOf.get(id)!)));
  return { supported, sourcesOf };
}

// convergence 범위(교집합 범위)에서 태그별 지지. source는 중복 없이 센다.
// 순서는 trace의 Claim 순서를 따른다.
export function traitSupportInConvergenceScope(trace: AnalysisTrace): Map<CoreTag, TraitSupport> {
  const { supported, sourcesOf } = supportedClaims(trace);
  const convergenceClaims = supported.filter((c) => CONVERGENCE_TARGETS.has(c.target));
  const support = new Map<CoreTag, TraitSupport>();
  for (const trait of unique(convergenceClaims.map((c) => c.trait))) {
    const claims = convergenceClaims.filter((c) => c.trait === trait);
    support.set(trait, {
      claimIds: claims.map((c) => c.id),
      sources: sourcesOf(claims),
      evidenceIds: unique(claims.flatMap((c) => c.evidenceIds)),
    });
  }
  return support;
}

export function deriveAnalysisPatterns(
  trace: AnalysisTrace,
  authoredPairs: ReadonlyArray<{ readonly tags: readonly [CoreTag, CoreTag] }>,
): AnalysisPattern[] {
  const { supported, sourcesOf } = supportedClaims(trace);
  const patterns: AnalysisPattern[] = [];

  for (const [trait, { sources, evidenceIds, claimIds }] of traitSupportInConvergenceScope(trace)) {
    if (sources.length < 2) continue;
    patterns.push({ kind: 'convergence', trait, sources, evidenceIds, claimIds });
  }

  const identityClaims = supported.filter((c) => IDENTITY_TARGETS.has(c.target));
  authoredPairs.forEach(({ tags: [a, b] }, pairIndex) => {
    const claimsA = identityClaims.filter((c) => c.trait === a);
    const claimsB = identityClaims.filter((c) => c.trait === b);
    if (claimsA.length === 0 || claimsB.length === 0) return;
    const sourcesA = sourcesOf(claimsA);
    const sourcesB = sourcesOf(claimsB);
    patterns.push({
      kind: 'authored-pair',
      ruleId: 'identity.conflict-pair@1',
      pairIndex,
      traits: [a, b],
      support: [
        { claimIds: claimsA.map((c) => c.id), sources: sourcesA },
        { claimIds: claimsB.map((c) => c.id), sources: sourcesB },
      ],
      sharedSources: sourcesA.filter((s) => sourcesB.includes(s)),
    });
  });

  return patterns;
}
