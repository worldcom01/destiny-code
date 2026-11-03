import type { CoreTag } from './analysis';
import type { IdentitySelectionReason } from './identitySelection';
import type { IntersectionModel, IntersectionPattern, IntersectionSource } from './intersection';

// ── engine v4: 근거 기반 개인 서술 (identity-narrative-1) ─────────────────────────
// archetype 문장(저작된 고정 문장) 아래에 "왜 이 결과인가"를 이 사람의 근거로만 설명한다.
// 선택된 성향·그 성향을 지지한 소스(세부값 포함)·대비·한 소스에서만 나온 면만 쓴다. 근거 없는 성향을 만들지 않는다.
// 상징 체계의 해석임을 전제로 하고 사실·예측처럼 단정하지 않는다. 결정적 템플릿이며 GPT를 쓰지 않는다.

const sourceText = (sources: IntersectionSource[]) =>
  sources.map((s) => (s.detail ? `${s.label}(${s.detail})` : s.label)).join(', ');

const hasBatchim = (word: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
};
const eunNeun = (word: string) => (hasBatchim(word) ? '은' : '는');
const gwaWa = (word: string) => (hasBatchim(word) ? '과' : '와');

export function buildIdentityNarrative(selection: IdentitySelectionReason, model: IntersectionModel): string[] {
  const byTrait = new Map<CoreTag, IntersectionPattern>([...model.common, ...model.complements].map((p) => [p.trait, p]));
  const lines: string[] = [];
  const traits = selection.selectedTraits;

  if (selection.decision === 'generic' || traits.length === 0) {
    lines.push('여러 분석 소스가 한 방향으로 모이지 않았습니다. 하나의 유형보다 소스마다 다른 면이 함께 있는 결과로 읽는 편이 맞습니다.');
  } else if (traits.length === 1) {
    lines.push(`여러 소스에서 가장 뚜렷하게 반복된 성향은 '${traits[0]}'입니다.`);
  } else {
    const allRare = traits.every((t) => byTrait.get(t)?.distinctiveness !== 'common');
    lines.push(allRare
      ? `이 결과를 다른 결과와 가장 구별하는 조합은 '${traits[0]}'${gwaWa(traits[0])} '${traits[1]}'입니다.`
      : `이 결과의 Identity는 '${traits[0]}'${gwaWa(traits[0])} '${traits[1]}'의 조합입니다.`);
  }

  for (const t of traits) {
    const p = byTrait.get(t);
    if (!p) continue;
    const rare = p.distinctiveness === 'distinctive' ? ' 흔하게 나오지 않는 근거들이 겹친 경우라 이 결과를 특징짓는 면입니다.'
      : p.distinctiveness === 'common' ? ' 다만 이 소스들에서 자주 나오는 근거라 단독으로는 개인차가 크지 않습니다.' : '';
    lines.push(`'${t}'${eunNeun(t)} ${sourceText(p.sources)}에서 함께 나타났습니다.${rare}`);
  }

  // A(핵심 패턴)의 상위 성향 중 Identity 조합에 들어가지 못한 드문 성향도 근거와 함께 밝힌다 — A와 E가 어긋나 보이지 않게
  const extra = model.common.slice(0, 2).filter((p) => !traits.includes(p.trait));
  for (const p of extra) {
    lines.push(p.distinctiveness === 'common'
      ? `'${p.trait}'도 ${sourceText(p.sources)}에서 겹쳤지만, 여러 사람에게 자주 나오는 근거라 Identity 조합에는 넣지 않았습니다.`
      : `'${p.trait}'도 ${sourceText(p.sources)}에서 겹친 뚜렷한 성향으로, 위 조합과 함께 이 결과를 특징짓습니다.`);
  }

  const tension = model.tensions.find((x) => x.traits.some((t) => traits.includes(t)) && !x.traits.every((t) => traits.includes(t)));
  if (tension) {
    const [a, b] = tension.traits;
    const mine = traits.includes(a) ? a : b;
    const other = mine === a ? b : a;
    const otherSide = mine === a ? tension.sides[1] : tension.sides[0];
    lines.push(`한편 '${mine}'${gwaWa(mine)} 다른 방향인 '${other}'도 ${sourceText(otherSide)}에서 보입니다. 상황에 따라 두 모습이 번갈아 드러날 수 있습니다.`);
  }

  const palmOnly = model.complements.filter((c) => c.sources[0]?.source === 'palm' && !traits.includes(c.trait));
  if (palmOnly.length > 0) {
    lines.push(`손금에서만 보인 ${palmOnly.map((c) => `'${c.trait}'(${c.sources[0].detail})`).join(', ')}${palmOnly.length > 1 ? '는' : eunNeun(palmOnly[0].trait)} 다른 소스가 짚지 못한 면으로 덧붙여 볼 수 있습니다.`);
  } else if (model.palmIncluded && traits.some((t) => byTrait.get(t)?.sources.some((s) => s.source === 'palm'))) {
    lines.push('손금 판독도 이 조합을 지지하는 근거 가운데 하나입니다.');
  }
  return lines;
}
