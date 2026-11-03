import type { CoreTag } from './analysis';
import { traitScore, TRAIT_ORDER } from './traitInformation';
import type { AnalysisTrace } from './evidenceTrace';
import {
  deriveAnalysisPatterns,
  traitSupportInConvergenceScope,
  type AuthoredPairPattern,
} from './analysisPatterns';

// ── Identity Selection v2 (engine v2) ───────────────────────────────────────
// 기존 authored catalog 안에서, 화면의 대표 교집합 태그와 여러 체계의 지지를 반영해 쌍을 고른다.
// 순수 함수: 시간·난수·네트워크·사용자 이력을 읽지 않는다. catalog는 인자로 받아 복제하지 않는다.
// 체계 간 일치는 매핑이 겹친다는 뜻이지 성향의 검증이 아니다 (AD-004).

export type IdentitySelectionReason = {
  version: 1; // 설명 데이터 형식, engineVersion과 별개
  ruleId: 'identity.selection@2' | 'identity.selection@3';
  representativeTrait: CoreTag | null; // 실제 convergence가 있을 때만
  decision: 'ranked-pair' | 'no-convergence-pair' | 'single' | 'generic' | 'distinctive-pair';
  pairIndex: number | null; // 고정 catalog의 위치 — engineVersion으로 의미 고정
  selectedTraits: CoreTag[];
  usedAuthoredOrder: boolean; // 최고 순위 동률 또는 no-convergence pair
  support: Array<{
    trait: CoreTag;
    claimIds: string[]; // convergence 범위, available Evidence만
    sources: string[]; // distinct source
  }>;
};

export interface IdentitySelectionInput {
  trace: AnalysisTrace;
  pairs: ReadonlyArray<{ readonly tags: readonly [CoreTag, CoreTag] }>;
  hasSingle: (trait: CoreTag) => boolean;
  keywordTag: CoreTag | undefined; // commonKeywords[0]의 CoreTag (convergence가 없으면 fallback 값일 수 있음)
  sajuFirstTag: CoreTag | undefined;
}

const sorted = (xs: string[]) => [...xs].sort();

export function selectIdentityV2(input: IdentitySelectionInput): IdentitySelectionReason {
  const { trace, pairs, hasSingle, keywordTag, sajuFirstTag } = input;
  const patterns = deriveAnalysisPatterns(trace, pairs);
  const support = traitSupportInConvergenceScope(trace);
  const sourcesOf = (t: CoreTag) => support.get(t)?.sources ?? [];
  const supportEntry = (trait: CoreTag) => ({
    trait,
    claimIds: sorted(support.get(trait)?.claimIds ?? []),
    sources: sorted(sourcesOf(trait)),
  });

  const convergence = patterns.filter((p) => p.kind === 'convergence');
  const candidates = patterns.filter((p): p is AuthoredPairPattern => p.kind === 'authored-pair');

  // 대표 태그: 화면의 commonKeywords[0]. 실제 convergence가 있으면 반드시 최대 지지 convergence여야 한다.
  let representative: CoreTag | null = null;
  if (convergence.length > 0) {
    const maxSources = Math.max(...convergence.map((c) => c.sources.length));
    const match = convergence.find((c) => c.trait === keywordTag);
    if (!keywordTag || !match || match.sources.length !== maxSources) {
      throw new Error(`identity v2: representative keyword ${keywordTag ?? '(none)'} is not a max-support convergence trait`);
    }
    representative = keywordTag;
  }

  const pairReason = (
    p: AuthoredPairPattern,
    decision: 'ranked-pair' | 'no-convergence-pair',
    usedAuthoredOrder: boolean,
  ): IdentitySelectionReason => ({
    version: 1,
    ruleId: 'identity.selection@2',
    representativeTrait: representative,
    decision,
    pairIndex: p.pairIndex,
    selectedTraits: [...p.traits],
    usedAuthoredOrder,
    support: p.traits.map(supportEntry),
  });

  if (candidates.length > 0) {
    // convergence가 없으면 v1과 같이 authored 순서의 첫 후보
    if (!representative) return pairReason(candidates[0], 'no-convergence-pair', true);

    // (대표 태그 포함, 약한 쪽 source 수, 양쪽 source 합집합 크기) 사전식 내림차순, 동률은 pairIndex 오름차순
    const rank = (p: AuthoredPairPattern): [number, number, number] => {
      const [a, b] = p.traits.map(sourcesOf);
      return [
        p.traits.includes(representative!) ? 1 : 0,
        Math.min(a.length, b.length),
        new Set([...a, ...b]).size,
      ];
    };
    const compare = (x: [number, number, number], y: [number, number, number]) =>
      x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

    let best = candidates[0];
    let bestRank = rank(best);
    let ties = 1;
    for (const p of candidates.slice(1)) {
      const r = rank(p);
      const c = compare(r, bestRank);
      if (c > 0) {
        best = p;
        bestRank = r;
        ties = 1;
      } else if (c === 0) {
        ties++;
        if (p.pairIndex < best.pairIndex) best = p;
      }
    }
    return pairReason(best, 'ranked-pair', ties > 1);
  }

  // 후보 쌍이 없으면 v1과 같은 single / generic fallback
  const primary = keywordTag ?? sajuFirstTag;
  if (primary && hasSingle(primary)) {
    return {
      version: 1, ruleId: 'identity.selection@2', representativeTrait: representative,
      decision: 'single', pairIndex: null, selectedTraits: [primary], usedAuthoredOrder: false,
      support: [supportEntry(primary)],
    };
  }
  return {
    version: 1, ruleId: 'identity.selection@2', representativeTrait: representative,
    decision: 'generic', pairIndex: null, selectedTraits: [], usedAuthoredOrder: false, support: [],
  };
}

// ── engine v4: Identity Selection v3 (identity.selection@3) ──────────────────────
// 근거 일관성: 쌍의 두 성향이 모두 2개 이상 소스의 지지를 받을 때만 쌍 Identity를 고른다(v2는 38.9%가 아니었다).
// 구별력: 성향 점수 = 지지 소스의 정보량 합(traitInformation.ts). 흔한 근거만 겹친 성향보다 드문 근거가 겹친
// 성향을 대표로 삼는다. 대표 성향 = 최고 점수의 수렴 성향.
// 순위: [대표 포함, 두 성향 중 낮은 점수, 점수 합, 앞 태그가 더 높은 점수인 방향] — 같은 태그 쌍의 두 archetype
// (체계적+창의적 / 창의적+체계적)은 어느 쪽이 더 강한지로 갈린다. 마지막 동률은 catalog 순서.
// 쌍이 없으면 대표 성향의 single, 수렴이 없으면 generic. 결정적이다.
export function selectIdentityV3(input: {
  trace: AnalysisTrace;
  pairs: ReadonlyArray<{ readonly tags: readonly [CoreTag, CoreTag] }>;
  hasSingle: (trait: CoreTag) => boolean;
}): IdentitySelectionReason {
  const support = traitSupportInConvergenceScope(input.trace);
  const score = new Map<CoreTag, number>();
  for (const [t, s] of support) if (s.sources.length >= 2) score.set(t, traitScore(t, s.sources));
  const supportEntry = (trait: CoreTag) => ({
    trait,
    claimIds: sorted(support.get(trait)?.claimIds ?? []),
    sources: sorted(support.get(trait)?.sources ?? []),
  });
  const base = { version: 1 as const, ruleId: 'identity.selection@3' as const };

  // 대표 = 최고 점수, 동률이면 고정 성향 순서 (trace·Map 순서에 의존하지 않는다)
  let representative: CoreTag | null = null;
  for (const t of TRAIT_ORDER) {
    const v = score.get(t);
    if (v !== undefined && (representative === null || v > score.get(representative)! + 1e-9)) representative = t;
  }

  type Rank = [number, number, number, number];
  let best: { index: number; tags: readonly [CoreTag, CoreTag]; rank: Rank } | null = null;
  let ties = 1;
  input.pairs.forEach(({ tags }, index) => {
    const [a, b] = tags;
    if (!score.has(a) || !score.has(b)) return;
    const sa = score.get(a)!, sb = score.get(b)!;
    const rank: Rank = [tags.includes(representative!) ? 1 : 0, Math.min(sa, sb), sa + sb, sa >= sb ? 1 : 0];
    if (!best) { best = { index, tags, rank }; return; }
    const cmp = rank.map((v, i) => v - best!.rank[i]).find((d) => Math.abs(d) > 1e-9) ?? 0;
    if (cmp > 0) { best = { index, tags, rank }; ties = 1; } else if (cmp === 0) ties++;
  });
  const chosen = best as { index: number; tags: readonly [CoreTag, CoreTag]; rank: Rank } | null;
  if (chosen) {
    return {
      ...base, representativeTrait: representative, decision: 'distinctive-pair', pairIndex: chosen.index,
      selectedTraits: [...chosen.tags], usedAuthoredOrder: ties > 1, support: chosen.tags.map(supportEntry),
    };
  }
  if (representative && input.hasSingle(representative)) {
    return {
      ...base, representativeTrait: representative, decision: 'single', pairIndex: null,
      selectedTraits: [representative], usedAuthoredOrder: false, support: [supportEntry(representative)],
    };
  }
  return { ...base, representativeTrait: representative, decision: 'generic', pairIndex: null, selectedTraits: [], usedAuthoredOrder: false, support: [] };
}
