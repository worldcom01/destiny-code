import type { CoreTag } from './analysis';
import { buildPalmEvidence } from './palmEvidence';
import { PALM_LINE_KEYS, type PalmLineKey, type PalmObservationBundle } from './palmObservation';
import {
  PALM_INTERPRETATION_RULE_VERSION,
  type PalmInterpretation,
  type PalmInterpretationSignal,
  type PalmSignalAttribute,
  type PalmSignalValue,
} from './palmSupplement';

// ── Palm Phase 1C: 결정적 상징적 해석 (palm-symbolic-1) ──────────────────────
// 제품이 저작한 상징적 읽기 8개뿐이다. 손 모양으로 성격을 검증한 규칙이 아니며,
// GPT는 여기서 아무것도 생성하지 않는다 (관찰 provider 역할만).
// 선마다 해석에 쓰는 속성은 하나(최대 1 signal/line, 최대 4개), 순서는 life/head/heart/fate.
// visible + 대상 속성 observed + 해당 Evidence available일 때만 규칙을 적용한다.
// not-detected/unreadable/unusable/읽지 못한 속성에는 해석·기본 태그를 만들지 않는다.
// 같은 bundle이면 항상 같은 signals(순서·ID 포함)를 만든다 — 시간·난수 없음.

type Rule = {
  key: string;
  line: PalmLineKey;
  attribute: PalmSignalAttribute;
  value: PalmSignalValue;
  trait?: CoreTag;
  text: string;
};

export const PALM_SYMBOLIC_RULES: readonly Rule[] = [
  { key: 'life-continuous', line: 'life', attribute: 'continuity', value: 'continuous',
    text: '이어진 선을 일상의 리듬이라는 상징으로 읽어봅니다. 꾸준히 지키고 싶은 습관은 무엇인가요?' },
  { key: 'life-interrupted', line: 'life', attribute: 'continuity', value: 'interrupted',
    text: '나뉘어 보이는 선을 리듬의 전환이라는 상징으로 읽어봅니다. 잠시 쉬고 다시 시작하는 방식은 어떤가요?' },
  { key: 'head-straight', line: 'head', attribute: 'curvature', value: 'straight', trait: '분석적',
    text: '곧은 흐름을 정리와 검토의 상징으로 읽어봅니다. 결정 전에 근거를 차근히 확인하는 편인가요?' },
  { key: 'head-curved', line: 'head', attribute: 'curvature', value: 'curved', trait: '창의적',
    text: '굽은 흐름을 탐색의 상징으로 읽어봅니다. 익숙한 답 밖의 가능성도 살펴보는 편인가요?' },
  { key: 'heart-straight', line: 'heart', attribute: 'curvature', value: 'straight',
    text: '곧은 흐름을 차분한 표현의 상징으로 읽어봅니다. 마음을 어떤 방식으로 전하고 싶나요?' },
  { key: 'heart-curved', line: 'heart', attribute: 'curvature', value: 'curved', trait: '감성적',
    text: '굽은 흐름을 감정 표현의 상징으로 읽어봅니다. 느낀 마음을 표현하는 방식은 어떤가요?' },
  { key: 'fate-continuous', line: 'fate', attribute: 'continuity', value: 'continuous', trait: '체계적',
    text: '이어진 흐름을 순서 있게 쌓아가는 과정의 상징으로 읽어봅니다. 계획을 이어가는 방식은 어떤가요?' },
  { key: 'fate-interrupted', line: 'fate', attribute: 'continuity', value: 'interrupted',
    text: '나뉜 흐름을 방향 점검의 상징으로 읽어봅니다. 목표를 다시 살펴보는 때는 언제인가요?' },
];

export const palmRuleId = (key: string) => `palm.symbolic.${key}@1`;

// 입력 bundle은 buildPalmEvidence 안에서 parsePalmObservationBundle로 전체 검증된다.
export function buildPalmInterpretation(bundle: PalmObservationBundle): PalmInterpretation {
  const evidence = buildPalmEvidence(bundle); // unusable이면 [] → signals 0개
  const available = new Map(evidence.filter((e) => e.status === 'available').map((e) => [e.id, e.value]));
  const signals: PalmInterpretationSignal[] = [];
  for (const line of PALM_LINE_KEYS) {
    for (const rule of PALM_SYMBOLIC_RULES) {
      if (rule.line !== line) continue;
      const evidenceId = `palm:line:${line}:${rule.attribute}`;
      if (available.get(`palm:line:${line}:visibility`) !== 'visible') continue;
      if (available.get(evidenceId) !== rule.value) continue;
      const signal: PalmInterpretationSignal = {
        id: `palm.signal.${rule.key}`,
        line,
        observedFeature: { attribute: rule.attribute, value: rule.value },
        interpretationKey: rule.key,
        ruleId: palmRuleId(rule.key),
        basis: 'symbolic',
        text: rule.text,
        evidenceIds: [evidenceId],
      };
      if (rule.trait) signal.trait = rule.trait;
      signals.push(signal);
      break; // 선마다 최대 1개
    }
  }
  return { version: 1, ruleVersion: PALM_INTERPRETATION_RULE_VERSION, signals };
}
