import { isAnalysisSnapshot, type AnalysisOutput, type AnalysisSnapshot, type CoreTag } from './analysis';
import {
  PALM_COMPARISON_RULE_VERSION,
  type PalmComparisonItem,
  type PalmInterpretation,
  type SupplementaryComparison,
} from './palmSupplement';

// ── Palm Phase 1C: 저장된 coreTags와의 보조 비교 (palm-comparison-1) ──────────
// 비교 기준은 Palm을 붙이는 바로 그 결과의 저장된 coreTags뿐이다 (읽기 전용 복사).
// 현재 입력 폼·다른 결과·재계산한 trace/pattern/Identity를 쓰지 않는다.
// legacy 결과(coreTags 없음)는 현재 규칙으로 재구성하지 않고 basis 'unavailable'로 둔다.
// 가중치·점수·확률·GPT 서술 없음. 문장은 고정 템플릿.
//
// MATCH   signal.trait가 base coreTags에 있음 (counterpart = 같은 tag)
// TENSION 저작된 두 쌍(분석적↔감성적, 창의적↔체계적)에서 signal trait의 짝이 base에 있음.
//         논리적 모순이 아니라 다른 방향의 관점이다. Identity conflict catalog와 무관.
// UNIQUE  위 둘이 모두 없거나 trait 없는 signal — "이 결과에서 따로 비교할 항목 없이 살펴볼 관점"
// MATCH와 TENSION은 동시에 성립할 수 있고 각각 별도 item이다. 순서: signal 순서 → MATCH, TENSION, UNIQUE.

export const PALM_TENSION_PAIRS: ReadonlyArray<readonly [CoreTag, CoreTag]> = [
  ['분석적', '감성적'],
  ['창의적', '체계적'],
];

const RULE = {
  MATCH: 'palm.comparison.match@1',
  TENSION: 'palm.comparison.tension@1',
  UNIQUE: 'palm.comparison.unique@1',
} as const;

function tensionCounterpart(trait: CoreTag): CoreTag | undefined {
  for (const [a, b] of PALM_TENSION_PAIRS) {
    if (trait === a) return b;
    if (trait === b) return a;
  }
  return undefined;
}

// 이 결과에 저장된 coreTags의 복사본. legacy 결과에는 null — 재구성하지 않는다.
export function baseTraitsOf(result: AnalysisSnapshot | AnalysisOutput): CoreTag[] | null {
  return isAnalysisSnapshot(result) ? [...result.coreTags] : null;
}

export function buildSupplementaryComparison(
  interpretation: PalmInterpretation,
  baseTraits: readonly CoreTag[] | null,
): SupplementaryComparison {
  if (baseTraits === null) {
    return { version: 1, ruleVersion: PALM_COMPARISON_RULE_VERSION, basis: 'unavailable', baseTraits: [], items: [] };
  }
  const base = new Set(baseTraits);
  const items: PalmComparisonItem[] = [];
  const seen = new Set<string>();
  const push = (item: PalmComparisonItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };
  for (const signal of interpretation.signals) {
    let related = false;
    if (signal.trait && base.has(signal.trait)) {
      related = true;
      push({
        id: `${signal.id}:MATCH:${signal.trait}`,
        signalId: signal.id,
        kind: 'MATCH',
        counterpart: signal.trait,
        ruleId: RULE.MATCH,
        text: `손바닥의 이 읽기는 기존 결과의 '${signal.trait}' 키워드와 겹치는 관점입니다.`,
      });
    }
    const opposite = signal.trait ? tensionCounterpart(signal.trait) : undefined;
    if (signal.trait && opposite && base.has(opposite)) {
      related = true;
      push({
        id: `${signal.id}:TENSION:${opposite}`,
        signalId: signal.id,
        kind: 'TENSION',
        counterpart: opposite,
        ruleId: RULE.TENSION,
        text: `손바닥의 '${signal.trait}' 읽기는 기존 결과의 '${opposite}' 키워드와 다른 방향의 관점입니다. 두 관점은 함께 있을 수 있습니다.`,
      });
    }
    if (!related) {
      push({
        id: `${signal.id}:UNIQUE`,
        signalId: signal.id,
        kind: 'UNIQUE',
        ruleId: RULE.UNIQUE,
        text: '기존 결과에 따로 비교할 항목이 없어, 새롭게 살펴볼 관점으로 남겨 둡니다.',
      });
    }
  }
  return {
    version: 1,
    ruleVersion: PALM_COMPARISON_RULE_VERSION,
    basis: 'snapshot-coreTags',
    baseTraits: [...baseTraits],
    items,
  };
}
