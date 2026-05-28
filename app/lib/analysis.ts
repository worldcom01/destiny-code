import { calculateSaju } from 'ssaju';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

export type CoreTag =
  | '창의적' | '분석적' | '감성적' | '실용적' | '사교적'
  | '독립적' | '직관적' | '체계적' | '열정적' | '포용적';

export type ElementKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export interface SajuOutput {
  pillars: { year: string; month: string; day: string; hour: string };
  dayStem: string;        // "辛"
  dayStemKo: string;      // "신"
  elements: Record<ElementKey, number>; // { wood: 2, fire: 1, ... }
  missingElements: ElementKey[];        // count === 0 인 오행
  dominantElement: ElementKey;          // 가장 많은 오행
  coreTags: CoreTag[];                  // 교집합 계산용 태그
  traits: string[];                     // UI 표시용 성향 키워드
  description: string;                  // 일간 기반 설명
  hasTime: boolean;                     // 시간 정보 포함 여부
}

export interface ZodiacResult {
  sign: string;
  signEn: string;
  symbol: string;
  element: string;
  rulingPlanet: string;
  coreTags: CoreTag[];
  description: string;
}

export interface MbtiResult {
  type: string;
  typeGroup: string;
  groupLabel: string;
  coreTags: CoreTag[];
  description: string;
  strengths: string[];
}

export interface BloodTypeResult {
  type: string;
  coreTags: CoreTag[];
  description: string;
  traits: string[];
}

export interface TarotResult {
  number: number;
  romanNumeral: string;
  name: string;
  nameEn: string;
  symbol: string;
  coreTags: CoreTag[];
  keywords: string[];
  meaning: string;
  currentFlow: string;
}

export interface ReadingSection {
  title: string;
  content: string;
}

export interface DetailedReading {
  sections: ReadingSection[];
  fateKeywords: string[];
}

export interface AnalysisOutput {
  saju: SajuOutput;
  zodiac: ZodiacResult;
  mbtiTraits: MbtiResult;
  bloodType: BloodTypeResult;
  tarot: TarotResult;
  commonKeywords: string[];
  detailedReading: DetailedReading;
  identityStatement: string;
  archetype: string;
}

// ── 사주 — 오행 메타데이터 ───────────────────────────────────────────────────

export const ELEMENT_META: Record<
  ElementKey,
  { label: string; chinese: string; color: string; bgColor: string; traits: string[] }
> = {
  wood:  { label: '목(木)', chinese: '木', color: 'text-green-400',  bgColor: 'bg-green-500',  traits: ['창의적 사고', '성장 지향', '독립심'] },
  fire:  { label: '화(火)', chinese: '火', color: 'text-red-400',    bgColor: 'bg-red-500',    traits: ['열정적 추진력', '카리스마', '직관력'] },
  earth: { label: '토(土)', chinese: '土', color: 'text-yellow-400', bgColor: 'bg-yellow-500', traits: ['신뢰성', '포용적 안정감', '현실 감각'] },
  metal: { label: '금(金)', chinese: '金', color: 'text-slate-300',  bgColor: 'bg-slate-400',  traits: ['분석적 사고', '원칙과 결단', '완벽주의'] },
  water: { label: '수(水)', chinese: '水', color: 'text-blue-400',   bgColor: 'bg-blue-500',   traits: ['깊은 직관력', '지혜로운 유연성', '탐구심'] },
};

// 오행 → CoreTag 매핑 (교집합 계산용)
const ELEMENT_CORE_TAGS: Record<ElementKey, CoreTag[]> = {
  wood:  ['창의적', '독립적'],
  fire:  ['열정적', '직관적'],
  earth: ['포용적', '실용적'],
  metal: ['분석적', '체계적'],
  water: ['직관적', '창의적'],
};

// 일간(日干) → 설명
const DAY_STEM_DESC: Record<string, string> = {
  甲: '갑목(甲木) 일간은 독립적 방향성이 강하게 작동하는 구조입니다. 스스로 설정한 목표를 향해 일직선으로 나아가려는 흐름이 반복되지만, 방향이 막혔을 때 내면의 저항감이 크게 활성화되는 패턴이 있습니다.',
  乙: '을목(乙木) 일간은 부드러운 외면 아래 강한 생명력이 흐르는 구조입니다. 유연하게 상황에 적응하면서도 결국 자신의 방향을 잃지 않는 흐름이 반복되지만, 지나친 적응이 자기 욕구의 억압으로 이어지는 패턴도 나타납니다.',
  丙: '병화(丙火) 일간은 열정과 표현 에너지가 외부로 강하게 흐르는 구조입니다. 주변을 이끄는 흐름이 자연스럽지만, 그 에너지가 소진될 때 급격한 무기력감이 교차하는 사이클이 반복됩니다.',
  丁: '정화(丁火) 일간은 섬세한 감수성과 내면의 통찰이 강하게 작동하는 구조입니다. 표면적으로는 조용하지만 내면에서는 지속적으로 감정과 관계를 처리하고 있는 흐름이 이어집니다.',
  戊: '무토(戊土) 일간은 안정과 포용을 중심으로 에너지가 작동하는 구조입니다. 주변을 받아들이는 폭이 넓지만, 그 과정에서 자신의 필요를 후순위에 두는 패턴이 반복됩니다.',
  己: '기토(己土) 일간은 꾸준한 실용성과 현실 감각이 핵심 에너지로 작동합니다. 성실하게 결실을 만들어가는 흐름이 강하지만, 인정받고 싶은 욕구가 드러나지 않은 채 쌓이는 패턴이 나타납니다.',
  庚: '경금(庚金) 일간은 강한 원칙과 결단력이 중심 흐름을 이룹니다. 명쾌한 판단과 추진력이 강하지만, 이 원칙이 자기비판의 형태로 내면을 향할 때 소진되는 패턴이 반복됩니다.',
  辛: '신금(辛金) 일간은 섬세한 심미 감각과 완벽 지향 에너지가 강하게 작동합니다. 세부적인 것을 놓치지 않는 꼼꼼함이 특징이지만, 그 기준이 자신에게 향할 때 과도한 자기비판이 활성화되는 패턴이 나타납니다.',
  壬: '임수(壬水) 일간은 깊은 통찰력과 유연한 흐름 감각이 핵심 에너지입니다. 상황을 읽는 능력이 뛰어나지만, 깊이 있는 내면 세계가 외부와의 소통 부재로 오해를 만드는 패턴이 반복됩니다.',
  癸: '계수(癸水) 일간은 깊은 감수성과 조용한 직관력이 중심 흐름을 이룹니다. 부드럽게 스며드는 방식으로 주변에 영향을 미치지만, 내면에서 처리되지 않은 감정이 오랫동안 누적되는 패턴이 나타납니다.',
};

// ── 태그 → 표시 레이블 ───────────────────────────────────────────────────────

const TAG_LABELS: Record<CoreTag, string> = {
  창의적: '창의적 사고',
  분석적: '분석적 사고',
  감성적: '감성적 공감',
  실용적: '실용적 실행',
  사교적: '뛰어난 사교성',
  독립적: '강한 독립심',
  직관적: '예리한 직관력',
  체계적: '체계적 사고',
  열정적: '넘치는 열정',
  포용적: '따뜻한 포용력',
};

// ── 별자리 데이터 ────────────────────────────────────────────────────────────

type ZodiacKey =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

const ZODIAC_DATA: Record<ZodiacKey, ZodiacResult> = {
  aries:       { sign: '양자리',    signEn: 'Aries',        symbol: '♈', element: '불',  rulingPlanet: '화성',   coreTags: ['열정적', '독립적', '실용적'], description: '양자리는 행동이 생각보다 앞서는 패턴이 반복됩니다. 열정이 빠르게 점화되는 만큼 소진도 빠른 사이클이 나타나며, 시작한 일을 끝까지 유지하는 것이 반복적인 과제로 등장합니다.' },
  taurus:      { sign: '황소자리',  signEn: 'Taurus',       symbol: '♉', element: '땅',  rulingPlanet: '금성',   coreTags: ['체계적', '감성적', '실용적'], description: '황소자리는 안정이 확인되기 전에는 쉽게 움직이지 않는 패턴이 있습니다. 한번 방향을 설정하면 강한 지속력을 보이지만, 변화에 대한 저항이 새로운 가능성을 차단하는 흐름이 반복됩니다.' },
  gemini:      { sign: '쌍둥이자리',signEn: 'Gemini',       symbol: '♊', element: '공기',rulingPlanet: '수성',   coreTags: ['사교적', '창의적', '직관적'], description: '쌍둥이자리는 다양한 방향으로 동시에 에너지가 흐르는 구조입니다. 폭넓은 탐색이 자연스럽지만, 하나에 깊이 몰입하기 어렵고 분산되는 패턴이 주기적으로 나타납니다.' },
  cancer:      { sign: '게자리',    signEn: 'Cancer',       symbol: '♋', element: '물',  rulingPlanet: '달',     coreTags: ['감성적', '포용적', '직관적'], description: '게자리는 감정의 파장이 깊고 넓게 형성됩니다. 타인의 정서를 빠르게 흡수하는 만큼 자신의 감정 경계가 흐릿해지는 순간이 반복되며, 가까운 관계일수록 에너지 소진이 커지는 흐름이 있습니다.' },
  leo:         { sign: '사자자리',  signEn: 'Leo',          symbol: '♌', element: '불',  rulingPlanet: '태양',   coreTags: ['열정적', '사교적', '창의적'], description: '사자자리는 중심에 서려는 에너지가 강하게 작동합니다. 인정받을 때 에너지가 활성화되지만, 그 인정에 대한 욕구가 외부 평가에 내면을 의존하게 만드는 패턴이 반복됩니다.' },
  virgo:       { sign: '처녀자리',  signEn: 'Virgo',        symbol: '♍', element: '땅',  rulingPlanet: '수성',   coreTags: ['분석적', '체계적', '실용적'], description: '처녀자리는 세부적인 것을 놓치지 않으려는 에너지가 강하게 작동합니다. 이 꼼꼼함이 완벽주의로 전환될 때 자기비판이 심화되거나 타인에 대한 기대가 높아지는 패턴이 반복됩니다.' },
  libra:       { sign: '천칭자리',  signEn: 'Libra',        symbol: '♎', element: '공기',rulingPlanet: '금성',   coreTags: ['사교적', '포용적', '창의적'], description: '천칭자리는 균형을 찾으려는 에너지가 중심에 흐릅니다. 조화를 유지하려는 과정에서 자신의 욕구를 억제하거나 결정을 지연하는 패턴이 반복적으로 나타납니다.' },
  scorpio:     { sign: '전갈자리',  signEn: 'Scorpio',      symbol: '♏', element: '물',  rulingPlanet: '명왕성', coreTags: ['독립적', '직관적', '열정적'], description: '전갈자리는 표면 아래를 파고드는 탐색 에너지가 강하게 작동합니다. 진실을 향한 강한 집착이 있지만, 그 강도가 스스로를 소진시키거나 관계에서 긴장을 만드는 흐름이 반복됩니다.' },
  sagittarius: { sign: '사수자리',  signEn: 'Sagittarius',  symbol: '♐', element: '불',  rulingPlanet: '목성',   coreTags: ['열정적', '독립적', '창의적'], description: '사수자리는 확장과 자유를 향한 에너지가 강하게 흐릅니다. 새로운 가능성에 빠르게 반응하지만, 현재의 것을 충분히 마무리하기 전에 다음으로 이동하는 패턴이 반복됩니다.' },
  capricorn:   { sign: '염소자리',  signEn: 'Capricorn',    symbol: '♑', element: '땅',  rulingPlanet: '토성',   coreTags: ['체계적', '실용적', '독립적'], description: '염소자리는 목표를 향해 천천히 쌓아가는 에너지 구조를 지닙니다. 책임감과 성취 지향이 강하지만, 그 과정에서 유연성이나 자기 돌봄을 후순위에 두는 패턴이 반복됩니다.' },
  aquarius:    { sign: '물병자리',  signEn: 'Aquarius',     symbol: '♒', element: '공기',rulingPlanet: '천왕성', coreTags: ['창의적', '독립적', '분석적'], description: '물병자리는 독립적 사고와 집단 흐름 사이를 오가는 구조를 지닙니다. 변화에 대한 욕구가 강하지만, 감정적 연결보다 개념과 이상에 먼저 반응하는 패턴이 있습니다.' },
  pisces:      { sign: '물고기자리',signEn: 'Pisces',       symbol: '♓', element: '물',  rulingPlanet: '해왕성', coreTags: ['감성적', '직관적', '창의적'], description: '물고기자리는 경계가 흐릿한 감수성이 핵심 에너지입니다. 깊은 공감과 상상력이 강점이지만, 타인의 감정과 현실의 압박을 과도하게 흡수하는 패턴이 반복됩니다.' },
};

// ── MBTI 데이터 ──────────────────────────────────────────────────────────────

const MBTI_DATA: Record<string, MbtiResult> = {
  INFJ:  { type: 'INFJ',  typeGroup: 'NF', groupLabel: '이상주의자', coreTags: ['직관적', '포용적', '체계적'],   strengths: ['깊은 통찰력',     '진정한 공감',       '전략적 비전'],    description: 'INFJ는 타인의 패턴을 깊이 읽어내는 감각이 강하게 작동합니다. 이 통찰이 관계 안에서 과도한 에너지 소진으로 이어지거나, 이상과 현실의 간극에서 자기실망이 반복됩니다.' },
  INFP:  { type: 'INFP',  typeGroup: 'NF', groupLabel: '이상주의자', coreTags: ['창의적', '감성적', '직관적'],   strengths: ['풍부한 상상력',   '진정성 있는 표현', '깊은 공감력'],   description: 'INFP는 내면의 가치 기준이 행동의 주요 척도가 됩니다. 이상과 현실의 간극이 클 때 감정 소진이 빠르게 일어나며, 자신을 표현하는 것과 숨기는 것 사이를 오가는 패턴이 반복됩니다.' },
  ENFJ:  { type: 'ENFJ',  typeGroup: 'NF', groupLabel: '이상주의자', coreTags: ['사교적', '포용적', '열정적'],   strengths: ['공감 리더십',     '강력한 동기부여',  '협력 촉진'],      description: 'ENFJ는 관계와 타인의 성장을 위해 에너지를 집중하는 구조입니다. 이 헌신이 자신의 필요를 후순위로 밀어내는 패턴을 만들며, 오랫동안 주는 역할만 하다 소진되는 흐름이 반복됩니다.' },
  ENFP:  { type: 'ENFP',  typeGroup: 'NF', groupLabel: '이상주의자', coreTags: ['창의적', '사교적', '열정적'],   strengths: ['끝없는 창의성',   '강한 열정',        '자유로운 발상'],   description: 'ENFP는 가능성과 연결에 빠르게 에너지를 쏟는 구조입니다. 열정이 여러 방향으로 분산될 때 깊이 있는 마무리보다 시작이 반복되는 패턴이 나타납니다.' },
  INTJ:  { type: 'INTJ',  typeGroup: 'NT', groupLabel: '합리주의자', coreTags: ['분석적', '독립적', '체계적'],   strengths: ['장기 전략 수립', '독립적 문제 해결', '시스템 최적화'],  description: 'INTJ는 내면에서 먼저 세계를 구축한 후 현실에 적용하는 구조를 지닙니다. 자신의 시스템에 대한 높은 확신이 타인의 방식을 수용하기 어렵게 만드는 패턴이 반복됩니다.' },
  INTP:  { type: 'INTP',  typeGroup: 'NT', groupLabel: '합리주의자', coreTags: ['분석적', '창의적', '독립적'],   strengths: ['논리적 사고',     '개념적 분석',      '독창적 이론 개발'], description: 'INTP는 개념과 논리를 끊임없이 해체하고 재조립하는 패턴이 강합니다. 분석이 충분히 완료되지 않으면 행동으로 나아가기 어려운 흐름이 반복되며, 지연 패턴으로 이어집니다.' },
  ENTJ:  { type: 'ENTJ',  typeGroup: 'NT', groupLabel: '합리주의자', coreTags: ['열정적', '체계적', '분석적'],   strengths: ['강력한 리더십',   '결단력 있는 실행', '전략적 조직화'],  description: 'ENTJ는 목표와 시스템을 중심으로 에너지가 흐르는 구조입니다. 강한 추진력이 타인의 페이스를 배려하지 못하는 마찰 패턴으로 이어지는 흐름이 반복됩니다.' },
  ENTP:  { type: 'ENTP',  typeGroup: 'NT', groupLabel: '합리주의자', coreTags: ['창의적', '사교적', '분석적'],   strengths: ['혁신적 아이디어', '논쟁을 통한 성장', '다양한 분야 통합'], description: 'ENTP는 새로운 아이디어와 가능성에 빠르게 반응하는 구조입니다. 시작의 에너지는 강하지만 하나에 오래 머무르기 어려운 분산 패턴이 반복됩니다.' },
  ISTJ:  { type: 'ISTJ',  typeGroup: 'SJ', groupLabel: '수호자',     coreTags: ['체계적', '실용적', '분석적'],   strengths: ['흔들림 없는 신뢰', '세심한 업무 처리', '체계적 관리'],   description: 'ISTJ는 증명된 방식과 구조에 에너지가 안정적으로 흐르는 구조입니다. 예측 가능한 환경에서 강점이 발휘되지만, 변화나 모호함이 큰 불편함을 야기하는 패턴이 반복됩니다.' },
  ISFJ:  { type: 'ISFJ',  typeGroup: 'SJ', groupLabel: '수호자',     coreTags: ['포용적', '감성적', '체계적'],   strengths: ['헌신적인 배려',   '세심한 관찰',      '안정적인 지원'],   description: 'ISFJ는 주변의 필요를 감지하고 조용히 채우는 패턴이 강하게 작동합니다. 이 헌신적 성향이 자신의 경계를 설정하는 것을 어렵게 만들거나, 인정받지 못할 때 누적되는 소진 패턴이 나타납니다.' },
  ESTJ:  { type: 'ESTJ',  typeGroup: 'SJ', groupLabel: '수호자',     coreTags: ['체계적', '열정적', '실용적'],   strengths: ['강력한 조직 관리','명확한 의사결정',  '현실적 리더십'],   description: 'ESTJ는 명확한 원칙과 체계를 통해 에너지가 흐르는 구조입니다. 효율과 결과에 집중하는 만큼 감정적 신호나 관계의 뉘앙스를 놓치는 패턴이 반복됩니다.' },
  ESFJ:  { type: 'ESFJ',  typeGroup: 'SJ', groupLabel: '수호자',     coreTags: ['사교적', '포용적', '감성적'],   strengths: ['탁월한 협력 능력','따뜻한 배려',      '공동체 결속'],     description: 'ESFJ는 조화로운 관계를 유지하려는 에너지가 강하게 작동합니다. 갈등을 피하려는 흐름이 자신의 진짜 감정을 억제하거나, 외부 인정에 내면의 안정을 의존하는 패턴으로 이어집니다.' },
  ISTP:  { type: 'ISTP',  typeGroup: 'SP', groupLabel: '장인',       coreTags: ['분석적', '독립적', '실용적'],   strengths: ['효율적 문제 해결','뛰어난 기술 습득', '냉철한 상황 판단'], description: 'ISTP는 논리적 분석과 실용적 해결에 에너지가 집중되는 구조입니다. 감정적 연결보다 기능적 연결을 우선시하는 성향이 관계에서 거리감으로 인식되는 패턴이 반복됩니다.' },
  ISFP:  { type: 'ISFP',  typeGroup: 'SP', groupLabel: '장인',       coreTags: ['감성적', '창의적', '실용적'],   strengths: ['풍부한 예술적 표현','유연한 적응력', '깊은 미적 감수성'], description: 'ISFP는 내면의 감각과 가치 기준이 중심 에너지로 작동합니다. 자신을 표현하고 싶은 욕구가 강하지만, 외부의 반응에 민감하게 반응하여 표현을 억제하는 패턴이 반복됩니다.' },
  ESTP:  { type: 'ESTP',  typeGroup: 'SP', groupLabel: '장인',       coreTags: ['실용적', '사교적', '열정적'],   strengths: ['즉각적 실행 능력','뛰어난 순발력',    '현장 대응력'],     description: 'ESTP는 현재 상황에서 즉각적으로 반응하는 에너지 구조를 지닙니다. 행동력이 뛰어나지만 장기적 결과보다 지금 이 순간의 자극에 우선 반응하는 패턴이 반복됩니다.' },
  ESFP:  { type: 'ESFP',  typeGroup: 'SP', groupLabel: '장인',       coreTags: ['사교적', '열정적', '포용적'],   strengths: ['뛰어난 유머와 활력','즉흥적 적응력', '사람들과의 연결'], description: 'ESFP는 현재의 경험과 연결에 에너지가 집중되는 구조입니다. 즐거움과 활력을 나누는 것이 자연스럽지만, 깊이 있는 내면 처리나 미래 준비를 뒤로 미루는 패턴이 반복됩니다.' },
};

// ── 혈액형 데이터 ────────────────────────────────────────────────────────────

const BLOOD_TYPE_DATA: Record<string, BloodTypeResult> = {
  A:  {
    type: 'A',
    coreTags: ['체계적', '감성적', '실용적'],
    traits: ['꼼꼼한 계획성', '높은 감수성', '신뢰성'],
    description: 'A형의 심리 패턴에서는 기대와 현실의 간극을 스스로에게 엄격하게 적용하는 흐름이 반복됩니다. 계획과 완성도에 강한 기준이 있는 만큼, 그 기준에 미치지 못할 때 자기비판이 활성화되는 패턴이 나타납니다.',
  },
  B:  {
    type: 'B',
    coreTags: ['창의적', '독립적', '직관적'],
    traits: ['창의적 발상', '강한 자기표현', '직관적 판단'],
    description: 'B형의 심리 패턴에서는 자신만의 기준과 방향을 유지하려는 흐름이 강하게 작동합니다. 이 독립성이 관계에서 단절이나 거리감으로 인식되는 오해 패턴이 반복될 수 있습니다.',
  },
  O:  {
    type: 'O',
    coreTags: ['열정적', '사교적', '실용적'],
    traits: ['강한 추진력', '사교적 친화력', '현실적 판단'],
    description: 'O형의 심리 패턴에서는 목표를 향해 강하게 밀어붙이는 에너지가 중심에 흐릅니다. 이 추진력이 타인의 페이스를 배려하지 못하거나, 스스로가 지지받고 싶다는 욕구를 드러내지 못하는 패턴이 반복됩니다.',
  },
  AB: {
    type: 'AB',
    coreTags: ['분석적', '창의적', '독립적'],
    traits: ['분석적 사고', '창의적 감각', '독립적 판단'],
    description: 'AB형의 심리 패턴에서는 이중적 성향이 내면의 일관성을 찾기 어렵게 만드는 흐름이 반복됩니다. 분석적 면모와 감성적 반응이 교차하며, 스스로도 예측하기 어려운 자신에 대한 혼란이 주기적으로 나타납니다.',
  },
};

// ── 타로 메이저 아르카나 데이터 ──────────────────────────────────────────────

export const TAROT_DATA: TarotResult[] = [
  { number: 0,  romanNumeral: '0',     name: '광대',         nameEn: 'The Fool',          symbol: '○', coreTags: ['창의적', '독립적', '직관적'], keywords: ['새로운 시작', '자유', '가능성', '도약'],       meaning: '경계를 넘어 새로운 영역으로 나아가는 순수한 용기와 시작의 에너지를 상징합니다.', currentFlow: '새로운 시작의 문턱에 서 있는 흐름입니다. 두려움 없이 미지의 세계로 발걸음을 내딛을 준비가 된 시기이며, 계획보다 직관을 따르는 것이 운명의 흐름과 일치합니다.' },
  { number: 1,  romanNumeral: 'I',     name: '마법사',       nameEn: 'The Magician',       symbol: '✦', coreTags: ['열정적', '창의적', '실용적'], keywords: ['의지', '실행력', '창조', '집중'],           meaning: '내면의 모든 자원을 하나의 의지로 집중하여 현실을 변화시키는 창조의 힘을 상징합니다.', currentFlow: '잠재력을 현실로 구현할 수 있는 강력한 에너지가 흐르는 시기입니다. 의지와 실행력이 운명을 바꿀 핵심 도구가 되는 때입니다.' },
  { number: 2,  romanNumeral: 'II',    name: '여사제',       nameEn: 'The High Priestess', symbol: '☽', coreTags: ['직관적', '감성적', '독립적'], keywords: ['직관', '신비', '내면', '지혜'],            meaning: '표면 너머에 숨겨진 진실을 읽는 내면의 지혜와 직관적 통찰의 힘을 상징합니다.', currentFlow: '직관과 내면의 목소리가 중요한 나침반이 되는 시기입니다. 논리보다 깊은 감각으로 방향을 결정해야 할 흐름이 나타납니다.' },
  { number: 3,  romanNumeral: 'III',   name: '여황제',       nameEn: 'The Empress',        symbol: '♀', coreTags: ['창의적', '포용적', '감성적'], keywords: ['풍요', '창의성', '양육', '자연'],           meaning: '풍요로운 창조력과 생명력으로 주변을 키워나가는 포용적 에너지를 상징합니다.', currentFlow: '창의적 표현과 풍요로운 에너지가 흐르는 성장의 시기입니다. 내면의 창조성이 현실에서 열매를 맺을 준비가 되어 있습니다.' },
  { number: 4,  romanNumeral: 'IV',    name: '황제',         nameEn: 'The Emperor',        symbol: '♂', coreTags: ['체계적', '실용적', '독립적'], keywords: ['권위', '구조', '안정', '리더십'],           meaning: '강한 의지와 체계적 리더십으로 질서와 안정을 구축하는 권위의 에너지를 상징합니다.', currentFlow: '강한 의지와 체계적 접근이 필요한 시기입니다. 현실적 기반을 다지고 리더십을 발휘할 흐름이 형성됩니다.' },
  { number: 5,  romanNumeral: 'V',     name: '교황',         nameEn: 'The Hierophant',     symbol: '⊕', coreTags: ['체계적', '감성적', '포용적'], keywords: ['전통', '가르침', '공동체', '신뢰'],         meaning: '전통과 공동체 안에서의 지혜를 통해 가르침을 전달하고 연결하는 에너지를 상징합니다.', currentFlow: '기존의 가치와 신뢰 기반 위에서 성장하는 흐름입니다. 멘토와 공동체의 지혜가 현재의 방향을 밝히는 시기입니다.' },
  { number: 6,  romanNumeral: 'VI',    name: '연인',         nameEn: 'The Lovers',         symbol: '◇', coreTags: ['감성적', '사교적', '직관적'], keywords: ['선택', '관계', '가치관', '조화'],           meaning: '핵심 가치를 바탕으로 한 선택과 깊은 연결의 에너지, 관계 안에서의 진정한 자아를 상징합니다.', currentFlow: '중요한 선택이나 관계의 흐름이 전면에 나타나는 시기입니다. 가치관에 기반한 결정이 운명의 방향을 결정합니다.' },
  { number: 7,  romanNumeral: 'VII',   name: '전차',         nameEn: 'The Chariot',        symbol: '▲', coreTags: ['열정적', '체계적', '독립적'], keywords: ['추진력', '통제', '승리', '의지'],           meaning: '상반된 힘을 하나의 방향으로 통제하며 목표를 향해 강하게 나아가는 승리의 에너지를 상징합니다.', currentFlow: '강한 추진력으로 목표를 향해 나아가야 할 시기입니다. 내면의 갈등을 통제하고 하나의 방향으로 집중하는 것이 관건입니다.' },
  { number: 8,  romanNumeral: 'VIII',  name: '힘',           nameEn: 'Strength',            symbol: '∞', coreTags: ['열정적', '포용적', '독립적'], keywords: ['내면의 힘', '용기', '인내', '자기통제'],    meaning: '두려움을 사랑으로 다스리는 내면의 진정한 힘과 용기를 상징합니다.', currentFlow: '내면의 강인함이 가장 중요한 자원이 되는 시기입니다. 외부 도전보다 자기 자신을 다스리는 능력이 운명을 결정합니다.' },
  { number: 9,  romanNumeral: 'IX',    name: '은둔자',       nameEn: 'The Hermit',         symbol: '◎', coreTags: ['독립적', '직관적', '분석적'], keywords: ['내성', '지혜', '고독', '성찰'],            meaning: '내면의 빛을 통해 자신만의 진리를 찾아가는 고독한 지혜의 여정을 상징합니다.', currentFlow: '내면을 들여다보고 성찰하는 시기가 요청됩니다. 외부의 소음보다 내면의 목소리에 집중하는 것이 현재 운명의 핵심 메시지입니다.' },
  { number: 10, romanNumeral: 'X',     name: '운명의 바퀴', nameEn: 'Wheel of Fortune',   symbol: '⊙', coreTags: ['직관적', '창의적', '실용적'], keywords: ['변화', '운명', '순환', '기회'],            meaning: '끊임없이 순환하는 운명의 바퀴 속에서 변화를 받아들이고 기회를 포착하는 지혜를 상징합니다.', currentFlow: '운명의 전환점에 서 있는 흐름이 감지됩니다. 변화의 물결을 저항보다 타고 가는 유연성이 현재 운명의 열쇠입니다.' },
  { number: 11, romanNumeral: 'XI',    name: '정의',         nameEn: 'Justice',             symbol: '⚖', coreTags: ['분석적', '체계적', '실용적'], keywords: ['공정', '균형', '진실', '결과'],            meaning: '행동의 결과에 따른 공정한 균형을 회복하고 진실과 원칙을 통해 조화를 이루는 에너지를 상징합니다.', currentFlow: '원인과 결과의 법칙이 강하게 작동하는 시기입니다. 공정한 판단과 균형 잡힌 결정이 현재 흐름의 핵심 요소가 됩니다.' },
  { number: 12, romanNumeral: 'XII',   name: '매달린 사람', nameEn: 'The Hanged Man',      symbol: '▽', coreTags: ['직관적', '감성적', '창의적'], keywords: ['관점 전환', '희생', '정지', '통찰'],       meaning: '자발적 정지와 관점의 전환을 통해 새로운 시야를 얻는 변혁적 지혜를 상징합니다.', currentFlow: '익숙한 관점에서 벗어나 다른 시각으로 상황을 바라볼 필요가 있는 시기입니다. 잠시 멈춤이 예상치 못한 통찰을 가져올 흐름입니다.' },
  { number: 13, romanNumeral: 'XIII',  name: '죽음',         nameEn: 'Death',               symbol: '◆', coreTags: ['독립적', '창의적', '직관적'], keywords: ['변환', '해방', '끝과 시작', '재생'],       meaning: '낡은 것의 끝과 새로운 것의 탄생, 변환을 통한 진정한 해방과 재생의 에너지를 상징합니다.', currentFlow: '어떤 것이 끝나고 새로운 것이 시작되는 변환의 흐름 안에 있습니다. 두려워하지 않고 변화를 받아들일 때 진정한 해방이 찾아오는 시기입니다.' },
  { number: 14, romanNumeral: 'XIV',   name: '절제',         nameEn: 'Temperance',          symbol: '△', coreTags: ['체계적', '포용적', '감성적'], keywords: ['균형', '조화', '통합', '인내'],            meaning: '상반된 에너지를 섬세하게 융합하여 완전한 조화와 통합을 이루는 지혜를 상징합니다.', currentFlow: '균형과 조화가 핵심 과제인 흐름입니다. 상반된 에너지를 통합하는 인내가 현재 운명의 성장 방향입니다.' },
  { number: 15, romanNumeral: 'XV',    name: '악마',         nameEn: 'The Devil',           symbol: '⬡', coreTags: ['열정적', '독립적', '실용적'], keywords: ['속박', '집착', '욕망', '해방의 열쇠'],     meaning: '스스로 만들어낸 집착과 두려움의 속박을 인식하고, 그 사슬을 끊을 수 있는 힘이 내면에 있음을 상징합니다.', currentFlow: '어떤 습관이나 집착이 에너지를 소진시키고 있는 시기일 수 있습니다. 스스로 만든 제약을 인식하는 것 자체가 현재 운명의 첫 번째 해방구입니다.' },
  { number: 16, romanNumeral: 'XVI',   name: '탑',           nameEn: 'The Tower',           symbol: '⌂', coreTags: ['직관적', '독립적', '창의적'], keywords: ['갑작스런 변화', '계시', '붕괴', '새 기반'], meaning: '오래된 구조의 갑작스러운 붕괴가 더 견고한 진실의 기반을 드러내는 변혁의 에너지를 상징합니다.', currentFlow: '예상치 못한 변화나 각성이 일어날 수 있는 흐름입니다. 무너지는 것은 진정한 기반이 아니었음을 신뢰하는 것이 현재 운명의 메시지입니다.' },
  { number: 17, romanNumeral: 'XVII',  name: '별',           nameEn: 'The Star',            symbol: '★', coreTags: ['감성적', '직관적', '포용적'], keywords: ['희망', '영감', '치유', '신뢰'],            meaning: '폭풍 이후에 떠오르는 희망의 빛, 치유와 영감으로 미래를 밝히는 별의 에너지를 상징합니다.', currentFlow: '희망과 영감이 현재 흐름을 이끄는 시기입니다. 과거의 상처가 치유되고 내면의 신뢰가 회복되는 흐름이 나타납니다.' },
  { number: 18, romanNumeral: 'XVIII', name: '달',           nameEn: 'The Moon',            symbol: '☾', coreTags: ['감성적', '직관적', '창의적'], keywords: ['무의식', '불안', '환상', '내면의 빛'],     meaning: '표면 아래 흐르는 무의식의 세계와 감추어진 두려움, 그리고 그 안에서 빛나는 직관을 상징합니다.', currentFlow: '무의식의 흐름이 강하게 작동하는 시기입니다. 혼란이나 불안이 느껴질 수 있지만, 그 안에서 중요한 내면의 신호를 읽어내야 할 때입니다.' },
  { number: 19, romanNumeral: 'XIX',   name: '태양',         nameEn: 'The Sun',             symbol: '☀', coreTags: ['열정적', '사교적', '창의적'], keywords: ['기쁨', '성공', '생명력', '밝음'],          meaning: '환한 빛으로 모든 것을 밝히는 기쁨과 성공, 생명력의 에너지를 상징합니다.', currentFlow: '밝고 긍정적인 에너지가 현재 흐름을 이끄는 시기입니다. 노력이 결실을 맺고 자연스러운 성공의 흐름이 활성화됩니다.' },
  { number: 20, romanNumeral: 'XX',    name: '심판',         nameEn: 'Judgement',           symbol: '◈', coreTags: ['분석적', '직관적', '체계적'], keywords: ['각성', '재탄생', '소명', '결단'],          meaning: '과거의 흐름을 정직하게 평가하고 내면의 소명에 응답하여 새롭게 재탄생하는 에너지를 상징합니다.', currentFlow: '중요한 각성이나 내면의 소명이 현재 흐름에 등장하는 시기입니다. 과거의 자신을 넘어 진정한 자아로 재탄생하는 변환이 요청됩니다.' },
  { number: 21, romanNumeral: 'XXI',   name: '세계',         nameEn: 'The World',           symbol: '◉', coreTags: ['체계적', '포용적', '실용적'], keywords: ['완성', '성취', '통합', '순환의 끝'],       meaning: '긴 여정의 완성과 모든 것의 통합, 새로운 순환의 시작을 앞둔 충만함을 상징합니다.', currentFlow: '한 주기의 완성이 가까워진 흐름이 감지됩니다. 오랜 노력이 결실을 맺거나 하나의 장이 마무리되고 더 넓은 세계로 나아갈 준비가 되는 시기입니다.' },
];

// ── 핵심 함수들 ──────────────────────────────────────────────────────────────

/** YYYY-MM-DD → 별자리 키 */
export function calcZodiacSign(birthdate: string): ZodiacKey {
  const [, mm, dd] = birthdate.split('-').map(Number);

  if ((mm === 12 && dd >= 22) || (mm === 1 && dd <= 19)) return 'capricorn';
  if ((mm === 1 && dd >= 20) || (mm === 2 && dd <= 18)) return 'aquarius';
  if ((mm === 2 && dd >= 19) || (mm === 3 && dd <= 20)) return 'pisces';
  if ((mm === 3 && dd >= 21) || (mm === 4 && dd <= 19)) return 'aries';
  if ((mm === 4 && dd >= 20) || (mm === 5 && dd <= 20)) return 'taurus';
  if ((mm === 5 && dd >= 21) || (mm === 6 && dd <= 20)) return 'gemini';
  if ((mm === 6 && dd >= 21) || (mm === 7 && dd <= 22)) return 'cancer';
  if ((mm === 7 && dd >= 23) || (mm === 8 && dd <= 22)) return 'leo';
  if ((mm === 8 && dd >= 23) || (mm === 9 && dd <= 22)) return 'virgo';
  if ((mm === 9 && dd >= 23) || (mm === 10 && dd <= 22)) return 'libra';
  if ((mm === 10 && dd >= 23) || (mm === 11 && dd <= 21)) return 'scorpio';
  return 'sagittarius';
}

/** ssaju 라이브러리로 사주 계산 후 SajuOutput 형태로 정규화 */
export function calcSaju(
  birthdate: string,
  birthtime: string,    // "HH:mm" 또는 ""
  gender: string        // "male" | "female" | "other"
): SajuOutput {
  const [year, month, day] = birthdate.split('-').map(Number);
  const hasTime = birthtime.length > 0;
  const [hour, minute] = hasTime
    ? birthtime.split(':').map(Number)
    : [12, 0];  // 시간 미입력 시 정오 기준

  const sajuGender = gender === 'female' ? '여' : '남';

  const result = calculateSaju({ year, month, day, hour, minute, gender: sajuGender });

  // 오행 (fiveElements keys: '목' '화' '토' '금' '수')
  const raw = result.fiveElements as Record<string, number>;
  const elements: Record<ElementKey, number> = {
    wood:  raw['목'] ?? 0,
    fire:  raw['화'] ?? 0,
    earth: raw['토'] ?? 0,
    metal: raw['금'] ?? 0,
    water: raw['수'] ?? 0,
  };

  const missingElements = (Object.keys(elements) as ElementKey[]).filter(
    (k) => elements[k] === 0
  );

  const dominantElement = (Object.entries(elements) as [ElementKey, number][]).sort(
    ([, a], [, b]) => b - a
  )[0][0];

  // 교집합 계산용 CoreTag — 지배 오행 + 부족 오행 보완 태그
  const coreTags = [
    ...ELEMENT_CORE_TAGS[dominantElement],
    ...ELEMENT_CORE_TAGS[missingElements[0] ?? dominantElement],
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3) as CoreTag[];

  // UI 표시용 성향 키워드 — 지배 오행 traits
  const traits = ELEMENT_META[dominantElement].traits;

  const dayStem = result.dayStem;
  const dayStemKo = result.pillarDetails.day.stemKo;
  const description =
    DAY_STEM_DESC[dayStem] ??
    `${dayStemKo}(${dayStem}) 일간을 지닌 당신은 독특하고 균형 잡힌 에너지를 지니고 있습니다.`;

  return {
    pillars: result.pillars,
    dayStem,
    dayStemKo,
    elements,
    missingElements,
    dominantElement,
    coreTags,
    traits,
    description,
    hasTime,
  };
}

/**
 * 여러 소스의 coreTags 교집합 계산.
 * n-way → (n-1)-way → ... → 2-way → fallback 순으로 시도.
 */
export function calcCommonKeywords(tagSets: CoreTag[][]): string[] {
  const nonEmpty = tagSets.filter((tags) => tags.length > 0);
  if (nonEmpty.length === 0) return [];

  // 각 태그가 몇 개 세트에 등장하는지 카운트
  const tagCounts = new Map<CoreTag, number>();
  nonEmpty.forEach((tags) => {
    new Set(tags).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });

  // k-way 교집합: n → 2 순으로 찾음
  for (let k = nonEmpty.length; k >= 2; k--) {
    const found: CoreTag[] = [];
    tagCounts.forEach((count, tag) => {
      if (count >= k) found.push(tag);
    });
    if (found.length > 0) return found.map((t) => TAG_LABELS[t]);
  }

  // fallback — 각 소스 첫 태그
  return [...new Set(nonEmpty.map((tags) => tags[0]).filter((t): t is CoreTag => Boolean(t)))]
    .map((t) => TAG_LABELS[t]);
}

/** 메이저 아르카나에서 랜덤 카드 1장 추출 */
function calcTarot(): TarotResult {
  return TAROT_DATA[Math.floor(Math.random() * TAROT_DATA.length)];
}

const NULL_MBTI: MbtiResult = {
  type: '',
  typeGroup: '',
  groupLabel: '미입력',
  coreTags: [],
  description: '',
  strengths: [],
};

function generateDetailedReading(
  saju: SajuOutput,
  zodiac: ZodiacResult,
  mbti: MbtiResult,
  bloodType: BloodTypeResult,
  tarot: TarotResult,
  commonKeywords: string[]
): DetailedReading {
  const hasMbti   = mbti.type.length === 4;
  const isIntro   = hasMbti && mbti.type[0] === 'I';
  const isFeeling = hasMbti && mbti.type[2] === 'F';
  const isJudging = hasMbti && mbti.type[3] === 'J';
  const dom       = saju.dominantElement;
  const missing   = saju.missingElements;
  const allTags   = [...new Set([
    ...saju.coreTags, ...zodiac.coreTags, ...bloodType.coreTags,
    ...(hasMbti ? mbti.coreTags : []), ...tarot.coreTags,
  ])];

  const corePatternMap: Partial<Record<CoreTag, string>> = {
    독립적: '외부의 판단보다 스스로 설정한 기준이 더 강하게 작동하는 흐름이 반복됩니다. 타인의 시선을 의식하면서도 결국 자신의 방향을 선택하는 구조입니다.',
    분석적: '생각이 정리되기 전에는 쉽게 행동으로 옮기지 못하는 흐름이 반복됩니다. 충분한 내부 처리 과정이 선행되어야 안심이 되는 구조입니다.',
    창의적: '아이디어와 가능성을 먼저 인식하고 현실적 제약은 나중에 검토하는 순서로 사고가 진행됩니다. 시작의 에너지는 풍부하지만 마무리에서 분산되는 패턴이 나타납니다.',
    감성적: '주변의 감정 흐름을 빠르게 감지하는 구조입니다. 타인의 상태를 먼저 읽고 반응하는 과정에서 자신의 감정 처리가 뒤로 밀리는 패턴이 반복됩니다.',
    포용적: '다양한 관점을 받아들이는 폭이 넓지만, 그 과정에서 자신의 경계를 어디에 두어야 할지 모호해지는 흐름이 주기적으로 반복됩니다.',
    체계적: '명확한 구조와 순서 속에서 안정감을 찾는 흐름이 반복됩니다. 모호함이나 예측 불가능한 상황은 내면의 불편함을 활성화하는 신호로 작동합니다.',
    직관적: '논리적 분석보다 감각적 신호를 먼저 처리하는 패턴이 있습니다. 설명하기 어렵지만 "알 것 같은" 확신이 반복적으로 찾아오는 구조입니다.',
    실용적: '이상보다 현실 가능성을 먼저 검토하는 흐름이 강합니다. 효율성과 실질적 결과를 중시하는 만큼 과정보다 결과에 무게를 두는 경향이 나타납니다.',
    사교적: '다양한 관계에서 에너지를 얻는 구조이지만, 관계의 폭이 넓어질수록 깊은 연결감을 찾기 어려운 순간이 반복될 수 있습니다.',
    열정적: '시작의 에너지가 강하게 타오르지만 장기적 지속력에서 소진되는 패턴이 주기적으로 나타납니다. 충전과 소진의 사이클이 반복되는 구조입니다.',
  };

  const conflictMap: Array<{ tags: [CoreTag, CoreTag]; text: string }> = [
    { tags: ['독립적', '포용적'], text: '혼자 있고 싶은 충동과 깊이 연결되고 싶은 욕구가 동시에 작동하는 내면 구조가 있습니다.' },
    { tags: ['독립적', '사교적'], text: '혼자만의 공간이 필요한 성향과 관계 안에서 활력을 얻는 성향이 교차하며, 어느 쪽도 완전히 포기하지 못하는 흐름이 반복됩니다.' },
    { tags: ['분석적', '감성적'], text: '논리로 정리하려는 충동과 감정이 먼저 반응하는 흐름이 교차합니다. 머리와 가슴이 다른 방향을 가리킬 때의 내적 긴장이 반복적 패턴입니다.' },
    { tags: ['체계적', '창의적'], text: '구조와 계획 안에서 안정을 찾으려는 성향과 그 구조에서 벗어나고 싶은 충동이 공존하는 긴장이 있습니다.' },
    { tags: ['열정적', '분석적'], text: '빠르게 행동하고 싶은 충동과 충분히 분석해야 한다는 기준 사이의 긴장이 반복됩니다.' },
    { tags: ['포용적', '체계적'], text: '다양한 상황을 수용하려는 성향과 명확한 기준을 유지하려는 흐름이 충돌하는 순간이 반복됩니다.' },
    { tags: ['독립적', '감성적'], text: '혼자 있고 싶은 성향과 감정적으로 연결되고 싶은 욕구가 충돌하며, 어느 쪽도 충분히 충족되지 않는 긴장이 반복됩니다.' },
    { tags: ['직관적', '실용적'], text: '직감을 따르고 싶은 흐름과 검증된 방법을 선호하는 성향이 교차하며, 결정 순간마다 두 흐름 사이에서 진동하는 패턴이 나타납니다.' },
    { tags: ['창의적', '체계적'], text: '새로운 것을 탐색하고 싶은 에너지와 기존 구조를 유지하려는 흐름 사이의 긴장이 반복됩니다.' },
  ];

  // ── 1. 반복되는 내면 구조 ──────────────────────────────────────────────────

  const primaryTag = (() => {
    const kwTag = commonKeywords.length > 0
      ? (Object.entries(TAG_LABELS) as [CoreTag, string][]).find(([, v]) => v === commonKeywords[0])?.[0]
      : undefined;
    return kwTag ?? saju.coreTags[0];
  })();

  const activeConflict = conflictMap.find(
    ({ tags: [a, b] }) => allTags.includes(a) && allTags.includes(b)
  );

  const kwLabel = commonKeywords.slice(0, 3).join(' · ');
  const systemsCount = hasMbti ? '다섯' : '네';

  const coreSection: ReadingSection = {
    title: '반복되는 내면 구조',
    content: [
      `${systemsCount}개 체계가 교차하며 반복적으로 나타나는 흐름은 "${kwLabel}"입니다.`,
      corePatternMap[primaryTag] ?? '',
      activeConflict?.text ?? '',
      `사주의 ${ELEMENT_META[dom].label} 기운이 이 패턴의 기저에서 지속적으로 작동합니다.`,
    ].filter(Boolean).join(' '),
  };

  // ── 2. 감정 처리 패턴 ─────────────────────────────────────────────────────

  const emotionSuppressionMap: Partial<Record<CoreTag, string>> = {
    분석적: '감정이 차오를 때 그것을 즉각 표출하기보다 내면에서 먼저 처리하려는 흐름이 작동합니다. 이 과정에서 감정이 충분히 소화되지 않은 채 누적되는 패턴이 반복됩니다.',
    체계적: '감정보다 상황 정리를 먼저 시도하는 경향이 있습니다. 감정을 처리하기 위한 조건과 순서를 만들려 하지만, 감정 자체는 그 순서를 따르지 않는 긴장이 반복됩니다.',
    독립적: '감정적 취약성을 드러내는 것에 내면의 저항이 있습니다. 스스로 정리된 상태에서만 감정을 나누려는 패턴이 반복되며, 그 이전에는 혼자 처리하려는 흐름이 강합니다.',
    실용적: '감정보다 행동 가능한 해결책을 먼저 찾으려는 성향이 있습니다. 감정 자체를 다루기보다 상황을 변화시키는 방향으로 에너지가 흐르는 패턴이 반복됩니다.',
  };

  const emotionExpressionMap: Partial<Record<CoreTag, string>> = {
    감성적: '감정의 파장이 넓고 깊게 형성됩니다. 타인의 정서 상태를 빠르게 흡수하는 만큼, 자신과 타인의 감정 경계가 흐릿해지는 순간이 반복됩니다.',
    열정적: '감정이 강하게 활성화될 때 그 에너지가 외부로 빠르게 흘러나오는 구조입니다. 고조되는 감정만큼 소진 후의 무기력함도 뚜렷하게 경험되는 사이클이 있습니다.',
    포용적: '타인의 감정을 먼저 수용하려는 패턴이 자신의 감정 처리를 뒤로 미루게 합니다. 오랫동안 쌓인 감정이 예상치 못한 시점에 표출되는 흐름이 나타납니다.',
    직관적: '감정을 언어보다 감각으로 먼저 인식합니다. 무언가 잘못되었다는 신호는 빠르게 오지만, 그것을 설명하거나 나누는 데 어려움이 생기는 패턴이 반복됩니다.',
  };

  const sajuEmotionMap: Record<ElementKey, string> = {
    water: '수(水) 기운이 강한 사주는 감정을 내면에서 깊이 숙성시키는 경향이 있습니다. 표면적으로는 잔잔해 보여도 내면의 감정 흐름은 지속적으로 작동하고 있습니다.',
    fire:  '화(火) 기운이 강한 사주는 감정이 빠르게 점화되고 강하게 표출되는 특성이 있습니다. 감정의 파고가 클 때와 소진 후 무기력감이 순환하는 패턴이 나타납니다.',
    earth: '토(土) 기운이 강한 사주는 감정을 외부로 드러내기 전에 내면에서 충분히 소화하려는 흐름이 있습니다. 이 소화 과정이 길어지면 감정이 표현되지 못한 채 누적됩니다.',
    metal: '금(金) 기운이 강한 사주는 감정에 직접 반응하기보다 정제하고 절제하려는 경향이 있습니다. 내면의 감정은 섬세하지만 외부 표현과의 간극이 반복됩니다.',
    wood:  '목(木) 기운이 강한 사주는 감정을 성장의 자원으로 처리하는 경향이 있습니다. 감정이 억압되면 행동 에너지가 막히는 흐름이 나타납니다.',
  };

  const mbtiEmotionNote = !hasMbti ? '' : isFeeling
    ? '감정을 처리할 때 관계 안에서 어떻게 받아들여지는지가 내면의 안정에 직접적인 영향을 미칩니다. 감정의 인정을 필요로 하는 흐름이 강합니다.'
    : '감정을 직접 다루기보다 그것을 야기한 상황을 분석하고 변화시키는 방향으로 에너지가 먼저 흐릅니다. 감정 자체와 마주하는 시간이 짧아지는 경향이 반복됩니다.';

  const suppressTag = saju.coreTags.find(t => emotionSuppressionMap[t]);
  const expressTag = [...saju.coreTags, ...zodiac.coreTags].find(t => emotionExpressionMap[t]);

  const emotionSection: ReadingSection = {
    title: '감정 처리 패턴',
    content: [
      suppressTag ? emotionSuppressionMap[suppressTag] : (expressTag ? emotionExpressionMap[expressTag] : ''),
      sajuEmotionMap[dom],
      mbtiEmotionNote,
      missing.includes('water') ? '사주에서 수(水)가 부재하는 것은 감정의 흐름을 의식적으로 들여다보는 연습이 반복적으로 요청되는 신호입니다.' : '',
    ].filter(Boolean).join(' '),
  };

  // ── 3. 관계 구조 ───────────────────────────────────────────────────────────

  const distanceMap: Partial<Record<CoreTag, string>> = {
    독립적: '가까워질수록 일정한 거리를 유지하려는 흐름이 자연스럽게 작동합니다. 이것은 냉담함이 아니라 자기 공간을 통해 에너지를 회복하는 방식입니다.',
    분석적: '관계를 시작하기 전에 상대를 충분히 파악하려는 관찰 기간이 필요한 구조입니다. 신뢰가 형성되기 전까지 내면을 쉽게 열지 않는 패턴이 반복됩니다.',
    체계적: '관계에도 명확한 기대와 역할이 있기를 원하는 성향이 있습니다. 모호한 관계 구조 안에서 불편함을 느끼며 정리하고 싶어지는 흐름이 반복됩니다.',
    감성적: '관계 안에서 상대방의 감정 상태를 빠르게 감지하지만, 그 민감함이 관계 피로로 이어지는 패턴이 주기적으로 나타납니다.',
  };

  const relFatigueMap: Partial<Record<CoreTag, string>> = {
    포용적: '관계 안에서 많은 것을 수용하고 배려하지만, 그 과정에서 자신의 에너지가 소진되는 흐름이 반복됩니다. 이해받고 싶지만 쉽게 요청하지 못하는 구조가 있습니다.',
    실용적: '감정적 교류보다 구체적인 공유와 행동 중심의 연결을 더 편안하게 여기는 경향이 나타납니다. 감정 언어가 자연스럽지 않은 관계에서 거리감이 형성되는 패턴이 반복됩니다.',
    사교적: '많은 사람들과 연결되지만 깊은 고민을 나눌 수 있는 관계는 좁아지는 역설이 반복됩니다. 표면적 연결이 풍부해질수록 내면의 외로움이 커지는 흐름이 있습니다.',
  };

  const zodiacRelMap: Record<string, string> = {
    '불': `${zodiac.sign}의 불 에너지는 관계 안에서 주도하고 이끄는 역할로 자연스럽게 이동합니다. 그 열기가 상대를 압도하거나 자신을 소진시키는 흐름도 동시에 작동합니다.`,
    '물': `${zodiac.sign}의 물 에너지는 깊은 감정적 유대를 갈망하지만, 그 깊이가 때로 의존이나 흡수의 패턴으로 전환되는 흐름이 반복됩니다.`,
    '땅': `${zodiac.sign}의 땅 에너지는 관계에서 신뢰와 지속성을 최우선으로 합니다. 새로운 관계보다 기존 관계를 유지하고 깊이를 더하는 방향으로 에너지가 흐릅니다.`,
    '공기': `${zodiac.sign}의 공기 에너지는 지적 교류와 아이디어의 공유가 관계의 핵심 연결 고리가 됩니다. 지적 자극이 없는 관계에서는 에너지가 빠지는 흐름이 나타납니다.`,
  };

  const introExtroNote = !hasMbti ? '' : isIntro
    ? '혼자 있는 시간이 관계 안에서 소진된 에너지를 회복하는 필수 조건입니다. 이 시간이 충분하지 않으면 관계에서 멀어지려는 충동이 강해집니다.'
    : '관계와 교류 속에서 에너지가 활성화되지만, 그 에너지가 외부로 지나치게 분산되면 내면의 신호를 놓치는 패턴이 나타납니다.';

  const bloodRelMap: Record<string, string> = {
    A:  '관계 안에서 기대에 부응하려는 흐름이 강하게 작동합니다. 상대가 원하는 것을 먼저 파악하고 충족시키려 하지만, 그 과정에서 자신의 욕구는 후순위로 밀리는 패턴이 반복됩니다.',
    B:  '관계 안에서도 자신만의 공간과 자유를 지키려는 성향이 강합니다. 이 경계가 상대에게는 거리감이나 단절로 느껴지는 오해가 반복될 수 있습니다.',
    O:  '관계에서 에너지를 주는 역할을 자주 맡게 됩니다. 이 역할이 지속될수록 본인이 지지받고 싶다는 욕구는 드러내지 못하는 구조가 나타납니다.',
    AB: '관계 안에서 가깝고 멀어지는 독특한 리듬이 있습니다. 이 리듬이 상대에게 예측 불가능한 패턴으로 인식되어 신뢰 형성이 더디게 진행되는 흐름이 반복됩니다.',
  };

  const relDistTag = allTags.find(t => distanceMap[t]);
  const relFatigueTag = allTags.find(t => relFatigueMap[t]);

  const relationSection: ReadingSection = {
    title: '관계 구조',
    content: [
      relDistTag ? distanceMap[relDistTag] : '',
      relFatigueTag ? relFatigueMap[relFatigueTag] : '',
      zodiacRelMap[zodiac.element] ?? '',
      introExtroNote,
      bloodRelMap[bloodType.type] ?? '',
    ].filter(Boolean).join(' '),
  };

  // ── 4. 현재 활성화되는 흐름 ───────────────────────────────────────────────

  const elementFlowMap: Record<ElementKey, string> = {
    wood:  '사주의 목(木) 에너지가 현재 새로운 방향으로 확장하려는 충동을 활성화시키고 있습니다. 이 흐름은 성장의 신호이지만, 뿌리가 충분히 내려지지 않은 상태에서의 확장은 에너지 분산을 일으킵니다.',
    fire:  '사주의 화(火) 에너지가 현재 강하게 활성화되어 있습니다. 추진하고 싶은 것이 명확해지는 시기이지만, 그 열기가 소진으로 이어지기 전에 조절 지점을 확인하는 것이 중요합니다.',
    earth: '사주의 토(土) 에너지가 현재 안정을 찾으려는 흐름을 만들고 있습니다. 변화보다 현재의 기반을 다지는 방향으로 에너지를 쓰는 것이 현재 흐름과 일치합니다.',
    metal: '사주의 금(金) 에너지가 현재 정리와 결단을 요청하는 흐름을 만들고 있습니다. 오래 유지해온 패턴이나 관계 중 놓아야 할 것을 인식하는 과정이 진행 중일 수 있습니다.',
    water: '사주의 수(水) 에너지가 현재 내면으로 흐르는 방향을 만들고 있습니다. 외부보다 내면의 신호에 더 많은 주의가 요청되는 시기입니다.',
  };

  const missingNote = missing.length > 0
    ? `현재 ${missing.map(el => ELEMENT_META[el].label).join(' · ')} 기운의 부재가 특정 영역에서의 막힘이나 불균형으로 감지될 수 있습니다.`
    : '';

  const judgeFlowNote = !hasMbti ? '' : isJudging
    ? '계획과 목표가 명확할 때 에너지가 가장 효율적으로 흐르는 구조입니다. 모호한 상태가 지속될 때 내면의 긴장이 높아지는 패턴이 반복됩니다.'
    : '유연하게 흐름을 따라가는 방식이 자연스럽지만, 방향이 너무 열려있을 때 에너지가 분산되는 패턴이 나타납니다. 최소한의 방향성이 현재 흐름을 안정시킵니다.';

  const flowSection: ReadingSection = {
    title: '현재 활성화되는 흐름',
    content: [
      elementFlowMap[dom],
      missingNote,
      judgeFlowNote,
      `선택된 "${tarot.name}" 카드가 현재 흐름을 확인합니다. ${tarot.currentFlow}`,
    ].filter(Boolean).join(' '),
  };

  // ── 5. 교차 신호 ───────────────────────────────────────────────────────────

  const systemsLabel = hasMbti ? '사주 · 별자리 · MBTI · 혈액형 · 타로' : '사주 · 별자리 · 혈액형 · 타로';

  const kwConvergence = commonKeywords.map((kw) => {
    const coreTag = (Object.entries(TAG_LABELS) as [CoreTag, string][])
      .find(([, v]) => v === kw)?.[0];
    if (!coreTag) return '';
    const sources: string[] = [];
    if (zodiac.coreTags.includes(coreTag)) sources.push(zodiac.sign);
    if (hasMbti && mbti.coreTags.includes(coreTag)) sources.push(mbti.type);
    if (saju.coreTags.includes(coreTag)) sources.push(ELEMENT_META[dom].label);
    if (bloodType.coreTags.includes(coreTag)) sources.push(`${bloodType.type}형`);
    if (tarot.coreTags.includes(coreTag)) sources.push(tarot.name);
    if (sources.length < 2) return '';
    return `"${kw}" 성향은 ${sources.join(' · ')}에서 독립적으로 반복 확인됩니다.`;
  }).filter(Boolean);

  const keywordSection: ReadingSection = {
    title: '교차 신호',
    content: [
      `${systemsLabel} — 서로 독립적인 체계들이 동시에 가리키는 교차점입니다.`,
      ...kwConvergence,
      '이 신호들이 한 방향으로 수렴한다는 것은, 이것이 단순한 성격 유형이 아니라 반복적으로 활성화되는 내면 패턴임을 의미합니다.',
    ].join(' '),
  };

  return {
    sections: [coreSection, emotionSection, relationSection, flowSection, keywordSection],
    fateKeywords: commonKeywords,
  };
}

// ── 정체성 생성 데이터 ──────────────────────────────────────────────────────

const CONFLICT_IDENTITY: Array<{ tags: [CoreTag, CoreTag]; identityStatement: string; archetype: string }> = [
  { tags: ['독립적', '포용적'],  identityStatement: '혼자이고 싶으면서도 깊이 연결되고 싶은 — 그 사이 어딘가에서 균형을 찾고 있는 사람입니다.', archetype: '경계 위에 선 사람' },
  { tags: ['독립적', '사교적'],  identityStatement: '혼자 달리는 것이 편하지만, 혼자만으로는 충분하지 않다는 것도 아는 사람입니다.', archetype: '고독한 연결 추구자' },
  { tags: ['분석적', '감성적'],  identityStatement: '머리로 이해되지 않으면 마음도 쉬지 못하는 — 감정까지 분석하려는 사람입니다.', archetype: '감정 분석가' },
  { tags: ['체계적', '창의적'],  identityStatement: '구조 안에서 자유를 꿈꾸는 — 안정이 필요하지만 틀에 갇히기 싫은 사람입니다.', archetype: '통제된 창의인' },
  { tags: ['열정적', '분석적'],  identityStatement: '행동하기 전에 너무 많이 생각하거나, 생각 없이 먼저 움직이거나 — 중간 없이 사는 사람입니다.', archetype: '충동과 이성 사이' },
  { tags: ['포용적', '체계적'],  identityStatement: '모든 것을 받아들이고 싶지만 동시에 모든 것을 정리하고 싶은 — 내면이 분주한 사람입니다.', archetype: '질서 있는 포용자' },
  { tags: ['독립적', '감성적'],  identityStatement: '감정이 깊지만 그것을 혼자 처리해야 한다고 느끼는 사람입니다.', archetype: '감정을 숨기는 독립인' },
  { tags: ['직관적', '실용적'],  identityStatement: '직감이 먼저 오지만 결국 증거를 찾아야 믿게 되는 — 의심 많은 직관가입니다.', archetype: '검증하는 직관가' },
  { tags: ['창의적', '체계적'],  identityStatement: '새로운 것을 만들고 싶지만 기반이 흔들리는 것이 두려운 사람입니다.', archetype: '안전한 도전자' },
  { tags: ['열정적', '포용적'],  identityStatement: '에너지는 넘치지만 타인을 위해 쓰다가 스스로 소진되는 흐름이 반복되는 사람입니다.', archetype: '소진되는 열정가' },
];

const SINGLE_IDENTITY: Partial<Record<CoreTag, { identityStatement: string; archetype: string }>> = {
  독립적:  { identityStatement: '스스로 설정한 기준이 가장 강하게 작동하는 — 자기 세계가 선명한 사람입니다.', archetype: '고독한 독립인' },
  분석적:  { identityStatement: '이해되지 않는 것은 내려놓기 어렵고, 이해되면 비로소 편안해지는 사람입니다.', archetype: '내면의 관찰자' },
  창의적:  { identityStatement: '가능성을 먼저 보고, 현실은 그 다음에 맞춰가는 사람입니다.', archetype: '현실 속 몽상가' },
  감성적:  { identityStatement: '타인의 감정을 먼저 읽고, 자신의 감정은 그 뒤에야 처리하는 사람입니다.', archetype: '감정을 짊어진 사람' },
  포용적:  { identityStatement: '경계를 세우는 것이 가장 오래 걸리는 과제인 사람입니다.', archetype: '경계 없는 포용자' },
  체계적:  { identityStatement: '불확실성을 구조로 길들이려는 — 질서에서 안정을 찾는 사람입니다.', archetype: '질서의 수호자' },
  직관적:  { identityStatement: '설명되지 않는 확신을 먼저 받고, 이유는 나중에 찾는 사람입니다.', archetype: '예리한 직관가' },
  실용적:  { identityStatement: '아이디어보다 결과로 증명하려는 — 행동하는 현실주의자입니다.', archetype: '행동하는 현실주의자' },
  사교적:  { identityStatement: '많은 사람들 속에서도 진짜 연결을 찾고 있는 사람입니다.', archetype: '고독한 사교인' },
  열정적:  { identityStatement: '완전히 타오르거나, 완전히 식거나 — 중간 없이 사는 사람입니다.', archetype: '전부 아니면 전무형' },
};

function generateIdentity(
  saju: SajuOutput,
  zodiac: ZodiacResult,
  mbti: MbtiResult,
  bloodType: BloodTypeResult,
  tarot: TarotResult,
  commonKeywords: string[]
): { identityStatement: string; archetype: string } {
  const hasMbti = mbti.type.length === 4;
  const allTags = [...new Set([
    ...saju.coreTags, ...zodiac.coreTags, ...bloodType.coreTags,
    ...(hasMbti ? mbti.coreTags : []), ...tarot.coreTags,
  ])];

  const conflictMatch = CONFLICT_IDENTITY.find(
    ({ tags: [a, b] }) => allTags.includes(a) && allTags.includes(b)
  );
  if (conflictMatch) return { identityStatement: conflictMatch.identityStatement, archetype: conflictMatch.archetype };

  const primaryTag = (() => {
    const kwTag = commonKeywords.length > 0
      ? (Object.entries(TAG_LABELS) as [CoreTag, string][]).find(([, v]) => v === commonKeywords[0])?.[0]
      : undefined;
    return kwTag ?? saju.coreTags[0];
  })();

  const match = primaryTag ? SINGLE_IDENTITY[primaryTag] : undefined;
  return match ?? {
    identityStatement: '여러 체계가 교차하며 드러나는 — 고유한 심리 패턴을 가진 사람입니다.',
    archetype: '복합적 패턴의 소유자',
  };
}

export function analyzeDestiny(
  birthdate: string,
  birthtime: string,
  mbti: string,
  gender: string,
  bloodtype: string,
  selectedCard?: TarotResult
): AnalysisOutput {
  const zodiacKey = calcZodiacSign(birthdate);
  const zodiac = ZODIAC_DATA[zodiacKey];
  const mbtiData = MBTI_DATA[mbti] ?? NULL_MBTI;
  const bloodTypeData = BLOOD_TYPE_DATA[bloodtype];
  const saju = calcSaju(birthdate, birthtime, gender);
  const tarot = selectedCard ?? calcTarot();

  const commonKeywords = calcCommonKeywords([
    zodiac.coreTags,
    mbtiData.coreTags,
    saju.coreTags,
    bloodTypeData.coreTags,
    tarot.coreTags,
  ]);

  const detailedReading = generateDetailedReading(saju, zodiac, mbtiData, bloodTypeData, tarot, commonKeywords);
  const { identityStatement, archetype } = generateIdentity(saju, zodiac, mbtiData, bloodTypeData, tarot, commonKeywords);

  return { saju, zodiac, mbtiTraits: mbtiData, bloodType: bloodTypeData, tarot, commonKeywords, detailedReading, identityStatement, archetype };
}
