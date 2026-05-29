import type { CoreTag } from './analysis';
import type { DestinyProfile } from './profileStore';

export interface CompatibilityResult {
  personAFlow: string;
  personBFlow: string;
  sharedTags: CoreTag[];
  relationLabel: string;
  relationNarrative: string;
  riskFactor: string;
  relationArchetype: string;
}

// ── 개인 흐름 — 관계 안에서 이 사람이 보이는 패턴 ──────────────────────────

const PERSON_FLOW_MAP: Partial<Record<CoreTag, string>> = {
  독립적: '혼자 있을 때 비로소 숨이 쉬어지는 사람입니다. 가까워질수록 일정한 거리를 유지하려 하지만, 그 거리가 냉담함이 아니라 에너지 회복의 방식이라는 것을 이해하는 데 시간이 걸립니다.',
  분석적: '상대를 이해하는 과정이 관계를 시작하는 방식입니다. 신뢰가 쌓이기 전까지는 마음을 천천히 열고, 내면을 드러내는 데 조심스러운 사람입니다.',
  창의적: '관계를 새로운 방식으로 만들어가려 합니다. 정해진 패턴보다 자유로운 연결을 선호하며, 자극과 가능성이 없는 관계에서 에너지가 빠지는 패턴이 있습니다.',
  감성적: '타인의 감정을 빠르게 읽고 깊이 반응하는 사람입니다. 감정적 연결이 관계의 핵심이며, 공감이 없는 관계에서는 외로움을 더 크게 느끼는 패턴이 있습니다.',
  포용적: '상대를 있는 그대로 받아들이려 합니다. 경계보다 수용을 먼저 선택하는 경향이 있고, 그 과정에서 자신의 욕구를 후순위로 두는 패턴이 반복됩니다.',
  체계적: '관계에서도 명확함과 일관성을 원하는 사람입니다. 불확실한 관계 구조에서 불편함을 느끼고, 관계의 방향이 정해질수록 안정감이 올라오는 패턴이 있습니다.',
  직관적: '말하지 않아도 상대의 상태를 감지하는 사람입니다. 직감으로 관계를 읽지만, 그 감각을 설명하기 어려워 오해가 생기는 경우가 있습니다.',
  실용적: '감정보다 함께 하는 행동으로 관계를 쌓아가는 사람입니다. 실질적인 도움과 신뢰가 애정 표현의 방식이며, 감정 언어보다 행동 언어가 더 자연스럽습니다.',
  사교적: '다양한 사람들과 자연스럽게 연결되는 사람입니다. 관계의 폭은 넓지만, 진짜 자신을 드러낼 수 있는 관계는 훨씬 좁은 역설이 있습니다.',
  열정적: '관계에 강하게 투자하는 사람입니다. 몰입할 때와 물러설 때의 강도 차이가 뚜렷하며, 그 사이클이 상대에게 예측하기 어렵게 느껴질 수 있습니다.',
};

// ── 공유 태그 → 관계 레이블 ──────────────────────────────────────────────────

const SHARED_TAG_LABEL: Partial<Record<CoreTag, string>> = {
  독립적: '서로의 공간을 이해하는 관계',
  분석적: '서로를 이해하려는 관계',
  창의적: '서로의 가능성을 자극하는 관계',
  감성적: '감정으로 연결된 관계',
  포용적: '서로를 받아들이는 관계',
  체계적: '서로의 방식을 존중하는 관계',
  직관적: '말 없이도 통하는 관계',
  실용적: '신뢰 기반의 실질적 연결',
  사교적: '활기찬 에너지의 연결',
  열정적: '강렬한 공명의 관계',
};

const TAG_PRIORITY: CoreTag[] = ['독립적', '직관적', '분석적', '감성적', '포용적', '창의적', '체계적', '열정적', '실용적', '사교적'];

// ── 관계 서사 패턴 ────────────────────────────────────────────────────────────

type NarrativeFn = (aT: CoreTag[], bT: CoreTag[], shared: CoreTag[]) => boolean;

const NARRATIVE_PATTERNS: Array<{ cond: NarrativeFn; text: string }> = [
  {
    cond: (_, __, s) => s.includes('독립적') && s.includes('직관적'),
    text: '말이 없어도 서로를 감지하는 두 사람입니다. 설명하지 않아도 통하는 순간이 있지만, 그 감각에 의존하다 보면 실제 대화가 줄어드는 패턴이 생길 수 있습니다. 가까운 것 같으면서도 미묘하게 거리가 유지되는 관계입니다.',
  },
  {
    cond: (_, __, s) => s.includes('독립적'),
    text: '둘 다 혼자 있는 시간이 필요한 사람들입니다. 서로의 공간을 자연스럽게 이해하지만, 그 거리가 때로 가까워지는 것을 더디게 만들 수 있습니다. 쉽게 마음을 열지는 않지만, 신뢰가 쌓이면 오래 관계를 유지하는 패턴이 있습니다.',
  },
  {
    cond: (_, __, s) => s.includes('감성적') && s.includes('포용적'),
    text: '둘 다 감정을 깊이 처리하고 상대를 받아들이려는 사람들입니다. 공감의 밀도가 높은 관계지만, 서로의 감정에 과도하게 영향받으면 경계가 흐릿해지는 패턴이 생길 수 있습니다. 서로에게 공간도 함께 필요한 관계입니다.',
  },
  {
    cond: (_, __, s) => s.includes('감성적'),
    text: '둘 다 감정을 깊게 처리하는 사람들입니다. 서로의 감정 상태를 빠르게 감지하지만, 그만큼 상대의 기분에 영향받는 구조가 만들어질 수 있습니다. 감정적 연결이 강할수록 경계도 더 필요해지는 관계입니다.',
  },
  {
    cond: (_, __, s) => s.includes('분석적'),
    text: '둘 다 상대를 이해하는 과정이 관계의 시작입니다. 신뢰가 쌓이기 전까지는 조심스럽게 접근하지만, 한 번 신뢰가 형성되면 깊이 연결되는 구조입니다. 처음엔 거리감이 느껴질 수 있지만, 서로의 신중함을 이해할수록 안정적인 관계가 만들어집니다.',
  },
  {
    cond: (_, __, s) => s.includes('직관적'),
    text: '둘 다 말하지 않아도 감지하는 부분이 있습니다. 설명 없이도 통하는 순간이 있지만, 동시에 서로가 느끼는 것을 표현하지 않아 오해가 쌓이는 패턴도 생길 수 있습니다.',
  },
  {
    cond: (a, b) => (a.includes('독립적') && b.includes('사교적')) || (a.includes('사교적') && b.includes('독립적')),
    text: '한 사람은 혼자 있을 때 충전되고, 다른 사람은 함께 있을 때 충전됩니다. 에너지 조율이 반복적으로 필요한 관계입니다. 이 차이가 오해를 만들기도 하지만, 서로에게 없는 방식을 배우게 만드는 관계이기도 합니다.',
  },
  {
    cond: (a, b) => (a.includes('분석적') && b.includes('감성적')) || (a.includes('감성적') && b.includes('분석적')),
    text: '한 사람은 이해로 관계를 만들고, 다른 사람은 감정으로 관계를 만듭니다. 접근 방식이 달라 처음엔 낯설 수 있지만, 서로가 부족한 부분을 채우는 구조가 만들어질 수 있습니다. 조금 더 인내가 필요한 관계입니다.',
  },
  {
    cond: (a, b) => (a.includes('체계적') && b.includes('창의적')) || (a.includes('창의적') && b.includes('체계적')),
    text: '한 사람은 구조 안에서 안정을 찾고, 다른 사람은 구조에서 벗어나려 합니다. 이 차이가 긴장을 만들기도 하지만, 서로를 보완하는 관계가 될 수 있습니다. 충분한 대화가 있을 때 균형이 만들어집니다.',
  },
  {
    cond: (_, __, s) => s.includes('포용적'),
    text: '둘 다 상대를 받아들이려는 마음이 큰 사람들입니다. 서로를 이해하고 존중하는 관계가 자연스럽게 만들어지지만, 둘 다 자신의 욕구를 후순위에 두는 경향이 있어 명확하게 표현하는 것이 더 필요한 관계입니다.',
  },
  {
    cond: () => true,
    text: '서로 다른 방식으로 세상을 처리하는 두 사람입니다. 가까워질수록 서로를 더 의식하게 되는 흐름이 있습니다. 처음엔 낯설 수 있지만, 시간이 지날수록 서로에게 없는 것을 발견하게 되는 관계입니다.',
  },
];

// ── 긴장 패턴 → 위험요소 ─────────────────────────────────────────────────────

const TENSION_MAP: Array<{ tags: [CoreTag, CoreTag]; risk: string }> = [
  {
    tags: ['독립적', '포용적'],
    risk: '한 사람은 공간이 필요하고, 다른 사람은 연결이 필요합니다. 이 차이가 해소되지 않으면 "왜 나를 밀어내는 거지"와 "왜 이렇게 가까이 오는 거지"라는 오해가 반복될 수 있습니다.',
  },
  {
    tags: ['독립적', '사교적'],
    risk: '한 사람은 혼자 있고 싶고, 다른 사람은 함께 있고 싶습니다. 에너지 조율 실패가 반복되면 거리감이 고착될 수 있습니다.',
  },
  {
    tags: ['분석적', '감성적'],
    risk: '한 사람은 이해를 먼저 원하고, 다른 사람은 공감을 먼저 원합니다. 각자의 방식이 상대에게 차갑거나 답답하게 느껴질 수 있습니다.',
  },
  {
    tags: ['체계적', '창의적'],
    risk: '한 사람은 예측 가능한 흐름을 원하고, 다른 사람은 유연함을 원합니다. 관계의 방향성이나 속도에서 반복적인 마찰이 생길 수 있습니다.',
  },
  {
    tags: ['열정적', '독립적'],
    risk: '한 사람의 강한 에너지가 다른 사람에게 부담이 될 수 있습니다. 열정과 공간 사이의 균형을 찾는 것이 이 관계의 핵심 과제입니다.',
  },
  {
    tags: ['직관적', '실용적'],
    risk: '한 사람은 감각으로 결정하고, 다른 사람은 근거로 결정합니다. 중요한 순간에 의사결정 방식의 충돌이 반복될 수 있습니다.',
  },
  {
    tags: ['열정적', '분석적'],
    risk: '한 사람의 속도가 다른 사람의 신중함과 충돌합니다. 움직이는 타이밍이 맞지 않아 서로 기다리거나 재촉하는 패턴이 나타날 수 있습니다.',
  },
  {
    tags: ['포용적', '체계적'],
    risk: '한 사람은 모든 것을 받아들이려 하고, 다른 사람은 명확하게 정리하려 합니다. 서로의 기대가 달라 엇갈리는 순간이 반복될 수 있습니다.',
  },
  {
    tags: ['독립적', '감성적'],
    risk: '한 사람은 감정을 혼자 처리하려 하고, 다른 사람은 감정적 연결을 원합니다. 표현 방식의 차이가 오해로 이어지는 패턴이 반복될 수 있습니다.',
  },
];

// ── 관계 Archetype ──────────────────────────────────────────────────────────

const RELATION_ARCHETYPES: Array<{
  cond: (s: CoreTag[], a: CoreTag[], b: CoreTag[]) => boolean;
  archetype: string;
}> = [
  { cond: (s) => s.includes('독립적') && s.includes('직관적'),       archetype: '침묵형 연결 관계' },
  { cond: (s) => s.includes('독립적') && s.includes('분석적'),       archetype: '거리 위의 이해 관계' },
  { cond: (s) => s.includes('독립적'),                               archetype: '거리 유지형 동행' },
  { cond: (s) => s.includes('직관적') && s.includes('감성적'),       archetype: '감각으로 이어진 관계' },
  { cond: (s) => s.includes('직관적'),                               archetype: '말 없이 통하는 관계' },
  { cond: (_, a, b) =>
      (a.includes('분석적') && b.includes('감성적')) ||
      (a.includes('감성적') && b.includes('분석적')),                 archetype: '서로를 해석하는 관계' },
  { cond: (s) => s.includes('감성적') && s.includes('포용적'),       archetype: '깊이 공명하는 관계' },
  { cond: (s) => s.includes('감성적'),                               archetype: '감정으로 이어진 관계' },
  { cond: (_, a, b) =>
      (a.includes('체계적') && b.includes('창의적')) ||
      (a.includes('창의적') && b.includes('체계적')),                 archetype: '구조와 자유 사이의 관계' },
  { cond: (s) => s.includes('창의적'),                               archetype: '자극과 영감의 관계' },
  { cond: (s) => s.includes('체계적'),                               archetype: '신뢰 위의 구조 관계' },
  { cond: (s) => s.includes('열정적'),                               archetype: '강렬한 에너지의 관계' },
  { cond: (s) => s.length === 0,                                     archetype: '각자의 세계를 가진 관계' },
  { cond: () => true,                                                archetype: '느린 신뢰 관계' },
];

// ── 엔진 ──────────────────────────────────────────────────────────────────────

function primaryTag(profile: DestinyProfile): CoreTag | undefined {
  return profile.coreTags[0];
}

function personFlow(profile: DestinyProfile): string {
  const tag = primaryTag(profile);
  const base = tag ? (PERSON_FLOW_MAP[tag] ?? '') : '';
  if (base) return base;
  return `${profile.archetype}인 사람입니다. 관계 안에서 자신만의 방식으로 연결을 만들어가는 흐름이 있습니다.`;
}

function relationLabel(shared: CoreTag[], aOnly: CoreTag[], bOnly: CoreTag[]): string {
  if (shared.length === 0) {
    if ((aOnly.includes('독립적') && bOnly.includes('사교적')) || (aOnly.includes('사교적') && bOnly.includes('독립적')))
      return '다른 에너지로 만나는 관계';
    if ((aOnly.includes('분석적') && bOnly.includes('감성적')) || (aOnly.includes('감성적') && bOnly.includes('분석적')))
      return '이해와 감각이 만나는 관계';
    if ((aOnly.includes('체계적') && bOnly.includes('창의적')) || (aOnly.includes('창의적') && bOnly.includes('체계적')))
      return '구조와 자유가 만나는 관계';
    return '각자의 세계를 가진 관계';
  }
  const top = TAG_PRIORITY.find(t => shared.includes(t)) ?? shared[0];
  return SHARED_TAG_LABEL[top] ?? '서로 닮은 부분이 있는 관계';
}

function riskFactor(aTags: CoreTag[], bTags: CoreTag[]): string {
  for (const entry of TENSION_MAP) {
    const [t1, t2] = entry.tags;
    if ((aTags.includes(t1) && bTags.includes(t2)) || (aTags.includes(t2) && bTags.includes(t1))) {
      return entry.risk;
    }
  }
  const aUniq = aTags.filter(t => !bTags.includes(t));
  const bUniq = bTags.filter(t => !aTags.includes(t));
  if (aUniq.length > 0 && bUniq.length > 0)
    return '두 사람이 서로 다르게 처리하는 영역이 있습니다. 그 차이가 보완이 될 수도 있지만, 이야기되지 않으면 서로에게 낯설게 느껴지는 패턴이 생길 수 있습니다.';
  return '두 사람 모두 자신의 방식에 익숙한 편입니다. 익숙함이 상대를 이해하는 과정을 더디게 만들 수 있습니다.';
}

export function analyzeCompatibility(a: DestinyProfile, b: DestinyProfile): CompatibilityResult {
  const aTags = a.coreTags;
  const bTags = b.coreTags;

  const sharedTags = aTags.filter(t => bTags.includes(t));
  const aOnly = aTags.filter(t => !bTags.includes(t));
  const bOnly = bTags.filter(t => !aTags.includes(t));

  const pattern = NARRATIVE_PATTERNS.find(p => p.cond(aTags, bTags, sharedTags));
  const archetype = RELATION_ARCHETYPES.find(p => p.cond(sharedTags, aOnly, bOnly));

  return {
    personAFlow: personFlow(a),
    personBFlow: personFlow(b),
    sharedTags,
    relationLabel: relationLabel(sharedTags, aOnly, bOnly),
    relationNarrative: pattern?.text ?? NARRATIVE_PATTERNS[NARRATIVE_PATTERNS.length - 1].text,
    riskFactor: riskFactor(aTags, bTags),
    relationArchetype: archetype?.archetype ?? '느린 신뢰 관계',
  };
}
