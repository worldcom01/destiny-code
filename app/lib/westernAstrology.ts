import type { CoreTag } from './analysis';

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

export type ZodiacKey =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export type PlanetKey = 'sun' | 'moon' | 'ascendant'
  | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'; // 확장 예약

export interface WesternSignData {
  sign: string;
  signEn: string;
  symbol: string;
  element: '불' | '땅' | '공기' | '물';
  modality: '활동' | '고정' | '변화';
  rulingPlanet: string;
  coreTags: CoreTag[];
  sunDescription: string;
  moonDescription: string;
  ascendantDescription: string;
  strengths: string[];
  weaknesses: string[];
  keywords: string[];
}

export interface WesternPlacement {
  planet: PlanetKey;
  planetSymbol: string;
  planetLabel: string;
  signKey: ZodiacKey;
  data: WesternSignData;
  description: string;
  degree?: number;
}

export type AstroDataLevel = 'sun-only' | 'sun-moon' | 'full';

export interface WesternAstrologyResult {
  sun: WesternPlacement;
  moon: WesternPlacement | null;
  ascendant: WesternPlacement | null;
  dataLevel: AstroDataLevel;
  coreTags: CoreTag[];
  keywords: string[];
  isApproximate: boolean;
}

// ── 출생지 도시 목록 ───────────────────────────────────────────────────────────

export interface CityOption {
  label: string;
  lat: number;
  lon: number;
}

export const CITY_OPTIONS: CityOption[] = [
  { label: '서울',             lat: 37.5665,  lon: 126.9780 },
  { label: '부산',             lat: 35.1796,  lon: 129.0756 },
  { label: '인천',             lat: 37.4563,  lon: 126.7052 },
  { label: '대구',             lat: 35.8714,  lon: 128.6014 },
  { label: '대전',             lat: 36.3504,  lon: 127.3845 },
  { label: '광주',             lat: 35.1595,  lon: 126.8526 },
  { label: '울산',             lat: 35.5384,  lon: 129.3114 },
  { label: '수원',             lat: 37.2636,  lon: 127.0286 },
  { label: '창원',             lat: 35.2280,  lon: 128.6811 },
  { label: '고양',             lat: 37.6584,  lon: 126.8320 },
  { label: '성남',             lat: 37.4200,  lon: 127.1269 },
  { label: '청주',             lat: 36.6424,  lon: 127.4890 },
  { label: '전주',             lat: 35.8242,  lon: 127.1480 },
  { label: '제주',             lat: 33.4996,  lon: 126.5312 },
  { label: '도쿄 (일본)',      lat: 35.6762,  lon: 139.6503 },
  { label: '오사카 (일본)',    lat: 34.6937,  lon: 135.5023 },
  { label: '뉴욕 (미국)',      lat: 40.7128,  lon: -74.0060 },
  { label: '로스앤젤레스 (미국)', lat: 34.0522, lon: -118.2437 },
  { label: '런던 (영국)',      lat: 51.5074,  lon: -0.1278  },
  { label: '베이징 (중국)',    lat: 39.9042,  lon: 116.4074 },
  { label: '상하이 (중국)',    lat: 31.2304,  lon: 121.4737 },
  { label: '시드니 (호주)',    lat: -33.8688, lon: 151.2093 },
  { label: '밴쿠버 (캐나다)', lat: 49.2827,  lon: -123.1207 },
  { label: '토론토 (캐나다)', lat: 43.6532,  lon: -79.3832  },
];

// ── 12궁 상세 데이터 ───────────────────────────────────────────────────────────

const SIGN_DATA: Record<ZodiacKey, WesternSignData> = {
  aries: {
    sign: '양자리', signEn: 'Aries', symbol: '♈',
    element: '불', modality: '활동', rulingPlanet: '화성',
    coreTags: ['열정적', '독립적', '실용적'],
    sunDescription: '양자리는 행동이 생각보다 앞서는 패턴이 반복됩니다. 열정이 빠르게 점화되는 만큼 소진도 빠른 사이클이 나타나며, 시작한 일을 끝까지 유지하는 것이 반복적인 과제로 등장합니다.',
    moonDescription: '달궁 양자리는 감정이 즉각적으로 점화되고 강하게 표출되는 구조입니다. 욕구가 지연될 때 좌절이 크게 활성화되지만 그만큼 빠르게 회복하는 탄력성도 강합니다.',
    ascendantDescription: '상승궁 양자리는 첫인상이 활기차고 직접적입니다. 에너지 넘치고 주도적인 이미지를 자연스럽게 발산하며, 새로운 상황에서 앞장서려는 흐름이 외부로 드러납니다.',
    strengths: ['강한 추진력', '개척 정신', '용기', '즉각적 실행력'],
    weaknesses: ['끈기 부족', '성급한 판단', '충동적 결정'],
    keywords: ['리더십', '개척', '용기', '추진력', '독립'],
  },
  taurus: {
    sign: '황소자리', signEn: 'Taurus', symbol: '♉',
    element: '땅', modality: '고정', rulingPlanet: '금성',
    coreTags: ['체계적', '감성적', '실용적'],
    sunDescription: '황소자리는 안정이 확인되기 전에는 쉽게 움직이지 않는 패턴이 있습니다. 한번 방향을 설정하면 강한 지속력을 보이지만, 변화에 대한 저항이 새로운 가능성을 차단하는 흐름이 반복됩니다.',
    moonDescription: '달궁 황소자리는 감정이 안정될 때까지 충분한 시간이 필요한 구조입니다. 변화가 감정적 불안을 야기하지만, 신뢰가 확인되면 깊고 지속적인 충성으로 이어지는 패턴이 있습니다.',
    ascendantDescription: '상승궁 황소자리는 안정적이고 신뢰할 수 있는 첫인상을 줍니다. 차분하고 여유 있는 이미지가 자연스럽게 드러나며, 심미적 감각이 외적 표현에서 자주 나타납니다.',
    strengths: ['강한 지속력', '현실 감각', '신뢰성', '심미적 감각'],
    weaknesses: ['변화 저항', '완고함', '물질적 집착'],
    keywords: ['안정', '지속력', '감각', '신뢰', '포용'],
  },
  gemini: {
    sign: '쌍둥이자리', signEn: 'Gemini', symbol: '♊',
    element: '공기', modality: '변화', rulingPlanet: '수성',
    coreTags: ['사교적', '창의적', '직관적'],
    sunDescription: '쌍둥이자리는 다양한 방향으로 동시에 에너지가 흐르는 구조입니다. 폭넓은 탐색이 자연스럽지만, 하나에 깊이 몰입하기 어렵고 분산되는 패턴이 주기적으로 나타납니다.',
    moonDescription: '달궁 쌍둥이자리는 감정이 언어와 생각으로 먼저 처리되는 구조입니다. 대화와 표현을 통해 안정을 찾지만, 깊이 느끼기보다 분석하려는 경향으로 감정을 회피하는 패턴이 반복됩니다.',
    ascendantDescription: '상승궁 쌍둥이자리는 밝고 호기심 많은 첫인상을 줍니다. 빠른 사고와 언어 표현이 자연스럽게 외부로 드러나며, 다양한 관심사로 다가가는 방식이 특징입니다.',
    strengths: ['뛰어난 적응력', '다재다능', '소통 능력', '지적 호기심'],
    weaknesses: ['산만함', '일관성 부족', '깊이 부족'],
    keywords: ['소통', '호기심', '다재다능', '적응', '표현'],
  },
  cancer: {
    sign: '게자리', signEn: 'Cancer', symbol: '♋',
    element: '물', modality: '활동', rulingPlanet: '달',
    coreTags: ['감성적', '포용적', '직관적'],
    sunDescription: '게자리는 감정의 파장이 깊고 넓게 형성됩니다. 타인의 정서를 빠르게 흡수하는 만큼 자신의 감정 경계가 흐릿해지는 순간이 반복되며, 가까운 관계일수록 에너지 소진이 커지는 흐름이 있습니다.',
    moonDescription: '달궁 게자리는 감정이 매우 민감하고 깊게 형성됩니다. 과거의 감정적 기억이 현재 반응에 강하게 영향을 미치며, 안전한 공간과 신뢰할 수 있는 관계가 감정 안정의 핵심 조건입니다.',
    ascendantDescription: '상승궁 게자리는 따뜻하고 배려가 느껴지는 첫인상을 줍니다. 감정 표현이 섬세하게 외부로 드러나며, 보호적이고 돌봄 지향적인 이미지가 자연스럽게 형성됩니다.',
    strengths: ['깊은 공감력', '직관적 감지력', '헌신적 돌봄', '강한 기억력'],
    weaknesses: ['감정 기복', '과보호 성향', '경계 설정 어려움'],
    keywords: ['감성', '보호', '직관', '공감', '기억'],
  },
  leo: {
    sign: '사자자리', signEn: 'Leo', symbol: '♌',
    element: '불', modality: '고정', rulingPlanet: '태양',
    coreTags: ['열정적', '사교적', '창의적'],
    sunDescription: '사자자리는 중심에 서려는 에너지가 강하게 작동합니다. 인정받을 때 에너지가 활성화되지만, 그 인정에 대한 욕구가 외부 평가에 내면을 의존하게 만드는 패턴이 반복됩니다.',
    moonDescription: '달궁 사자자리는 인정과 긍정적 반응이 감정 안정의 핵심 자원입니다. 창의적 표현이 감정 출구가 되지만, 인정이 충분하지 않을 때 자존감이 흔들리는 패턴이 나타납니다.',
    ascendantDescription: '상승궁 사자자리는 당당하고 존재감 있는 첫인상을 줍니다. 자신감과 카리스마가 외부로 자연스럽게 발산되며, 주목받는 상황에서 에너지가 더욱 활성화됩니다.',
    strengths: ['카리스마', '창의적 표현력', '리더십', '관대함'],
    weaknesses: ['인정 욕구 의존', '자기중심성', '오만함'],
    keywords: ['카리스마', '창조', '표현', '리더십', '자신감'],
  },
  virgo: {
    sign: '처녀자리', signEn: 'Virgo', symbol: '♍',
    element: '땅', modality: '변화', rulingPlanet: '수성',
    coreTags: ['분석적', '체계적', '실용적'],
    sunDescription: '처녀자리는 세부적인 것을 놓치지 않으려는 에너지가 강하게 작동합니다. 이 꼼꼼함이 완벽주의로 전환될 때 자기비판이 심화되거나 타인에 대한 기대가 높아지는 패턴이 반복됩니다.',
    moonDescription: '달궁 처녀자리는 걱정과 세밀한 분석을 통해 감정을 처리하는 패턴이 있습니다. 환경이 정돈되어 있을 때 안정감을 느끼며, 불완전한 상황에서 내면 불안이 높아지는 흐름이 반복됩니다.',
    ascendantDescription: '상승궁 처녀자리는 차분하고 세심한 첫인상을 줍니다. 꼼꼼하고 실용적인 이미지가 외부 행동에서 드러나며, 도움이 되려는 태도가 자연스럽게 표출됩니다.',
    strengths: ['세밀한 분석력', '실용적 문제 해결', '완성도 추구', '서비스 정신'],
    weaknesses: ['완벽주의', '과도한 자기비판', '걱정 패턴'],
    keywords: ['분석', '완성', '서비스', '실용', '세밀함'],
  },
  libra: {
    sign: '천칭자리', signEn: 'Libra', symbol: '♎',
    element: '공기', modality: '활동', rulingPlanet: '금성',
    coreTags: ['사교적', '포용적', '창의적'],
    sunDescription: '천칭자리는 균형을 찾으려는 에너지가 중심에 흐릅니다. 조화를 유지하려는 과정에서 자신의 욕구를 억제하거나 결정을 지연하는 패턴이 반복적으로 나타납니다.',
    moonDescription: '달궁 천칭자리는 조화로운 환경과 관계가 감정 안정의 핵심 조건입니다. 갈등 상황에서 불편함이 강하게 활성화되며, 타인을 맞추려다 자신의 감정을 뒤로 미루는 패턴이 반복됩니다.',
    ascendantDescription: '상승궁 천칭자리는 우아하고 균형 잡힌 첫인상을 줍니다. 외교적이고 조화를 중시하는 태도가 자연스럽게 드러나며, 심미적 감각이 외적 표현에서 두드러집니다.',
    strengths: ['균형 감각', '외교적 능력', '심미안', '공정성'],
    weaknesses: ['우유부단함', '갈등 회피', '타인 의존'],
    keywords: ['균형', '조화', '외교', '공정', '심미'],
  },
  scorpio: {
    sign: '전갈자리', signEn: 'Scorpio', symbol: '♏',
    element: '물', modality: '고정', rulingPlanet: '명왕성',
    coreTags: ['독립적', '직관적', '열정적'],
    sunDescription: '전갈자리는 표면 아래를 파고드는 탐색 에너지가 강하게 작동합니다. 진실을 향한 강한 집착이 있지만, 그 강도가 스스로를 소진시키거나 관계에서 긴장을 만드는 흐름이 반복됩니다.',
    moonDescription: '달궁 전갈자리는 감정이 강렬하고 깊게 숙성되는 구조입니다. 감정을 쉽게 드러내지 않지만 내면에서 강하게 처리되며, 신뢰와 배신에 대한 기억이 오랫동안 유지되는 패턴이 있습니다.',
    ascendantDescription: '상승궁 전갈자리는 강렬하고 깊이 있는 첫인상을 줍니다. 신비롭고 통찰력 있는 이미지가 외부로 드러나며, 속을 쉽게 내보이지 않는 태도가 자연스럽게 형성됩니다.',
    strengths: ['깊은 통찰력', '강한 의지', '변환 능력', '진실 탐구력'],
    weaknesses: ['집착 패턴', '불신 성향', '감정 억압'],
    keywords: ['통찰', '변환', '의지', '심층', '진실'],
  },
  sagittarius: {
    sign: '사수자리', signEn: 'Sagittarius', symbol: '♐',
    element: '불', modality: '변화', rulingPlanet: '목성',
    coreTags: ['열정적', '독립적', '창의적'],
    sunDescription: '사수자리는 확장과 자유를 향한 에너지가 강하게 흐릅니다. 새로운 가능성에 빠르게 반응하지만, 현재의 것을 충분히 마무리하기 전에 다음으로 이동하는 패턴이 반복됩니다.',
    moonDescription: '달궁 사수자리는 자유롭고 낙관적인 방식으로 감정을 처리합니다. 새로운 경험이 감정 회복의 핵심 방식이지만, 불편한 감정을 빠르게 회피하려는 패턴이 나타날 수 있습니다.',
    ascendantDescription: '상승궁 사수자리는 낙관적이고 자유로운 첫인상을 줍니다. 개방적이고 모험적인 에너지가 자연스럽게 드러나며, 철학적이고 유머 있는 방식으로 접근하는 특징이 있습니다.',
    strengths: ['낙관적 에너지', '철학적 사고', '모험심', '성장 지향'],
    weaknesses: ['마무리 부족', '무책임함', '과장 성향'],
    keywords: ['자유', '철학', '모험', '낙관', '확장'],
  },
  capricorn: {
    sign: '염소자리', signEn: 'Capricorn', symbol: '♑',
    element: '땅', modality: '활동', rulingPlanet: '토성',
    coreTags: ['체계적', '실용적', '독립적'],
    sunDescription: '염소자리는 목표를 향해 천천히 쌓아가는 에너지 구조를 지닙니다. 책임감과 성취 지향이 강하지만, 그 과정에서 유연성이나 자기 돌봄을 후순위에 두는 패턴이 반복됩니다.',
    moonDescription: '달궁 염소자리는 감정을 통제하고 이성적으로 처리하려는 성향이 강합니다. 외부에서는 안정적으로 보이지만 내면에서는 많은 감정이 처리되고 있으며, 감정적 취약성을 드러내는 것에 저항이 있습니다.',
    ascendantDescription: '상승궁 염소자리는 신뢰할 수 있고 목표 지향적인 첫인상을 줍니다. 진지하고 책임감 있는 이미지가 외부 행동에서 자연스럽게 드러나며, 구조와 성취를 중시하는 태도가 표출됩니다.',
    strengths: ['강한 목표 지향성', '인내력', '책임감', '현실적 판단'],
    weaknesses: ['자기 돌봄 부족', '감정 억압', '완고함'],
    keywords: ['목표', '성취', '책임', '현실', '인내'],
  },
  aquarius: {
    sign: '물병자리', signEn: 'Aquarius', symbol: '♒',
    element: '공기', modality: '고정', rulingPlanet: '천왕성',
    coreTags: ['창의적', '독립적', '분석적'],
    sunDescription: '물병자리는 독립적 사고와 집단 흐름 사이를 오가는 구조를 지닙니다. 변화에 대한 욕구가 강하지만, 감정적 연결보다 개념과 이상에 먼저 반응하는 패턴이 있습니다.',
    moonDescription: '달궁 물병자리는 감정보다 개념과 이상을 우선시하는 구조입니다. 정신적 교류에서 안정을 찾으며, 감정적으로 가까워지는 것에 대한 무의식적 저항이 나타나는 패턴이 있습니다.',
    ascendantDescription: '상승궁 물병자리는 독특하고 혁신적인 첫인상을 줍니다. 독립적이고 개성 있는 이미지가 자연스럽게 드러나며, 기존 틀에 얽매이지 않는 접근 방식이 특징입니다.',
    strengths: ['독립적 사고', '혁신성', '인도주의 감각', '미래 지향'],
    weaknesses: ['감정적 거리감', '고집', '분리적 성향'],
    keywords: ['혁신', '독립', '인도주의', '미래', '자유'],
  },
  pisces: {
    sign: '물고기자리', signEn: 'Pisces', symbol: '♓',
    element: '물', modality: '변화', rulingPlanet: '해왕성',
    coreTags: ['감성적', '직관적', '창의적'],
    sunDescription: '물고기자리는 경계가 흐릿한 감수성이 핵심 에너지입니다. 깊은 공감과 상상력이 강점이지만, 타인의 감정과 현실의 압박을 과도하게 흡수하는 패턴이 반복됩니다.',
    moonDescription: '달궁 물고기자리는 감정의 경계가 매우 유동적인 구조입니다. 타인의 감정을 깊이 흡수하는 공감 능력이 강하지만, 자신과 타인의 감정 경계가 흐릿해지는 소진 패턴이 반복됩니다.',
    ascendantDescription: '상승궁 물고기자리는 부드럽고 감성적인 첫인상을 줍니다. 공감 능력과 예술적 감수성이 자연스럽게 외부로 드러나며, 경계가 유동적이고 적응적인 이미지가 형성됩니다.',
    strengths: ['풍부한 공감력', '영적 감수성', '창의적 상상력', '뛰어난 적응력'],
    weaknesses: ['경계 부재', '현실 도피', '자기희생 패턴'],
    keywords: ['공감', '영성', '창의', '직관', '감수성'],
  },
};

// ── 천문학 계산 유틸리티 ────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** 그레고리력 날짜 + UT시간 → Julian Day Number */
function toJD(year: number, month: number, day: number, hour = 12, minute = 0): number {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + hour / 24 + minute / 1440 + B - 1524.5;
}

/** JD로부터 황도 경도(도) → 궁 인덱스 (0=양자리 … 11=물고기) */
function longitudeToSignIndex(lon: number): number {
  return Math.floor(normalizeAngle(lon) / 30);
}

const SIGN_ORDER: ZodiacKey[] = [
  'aries', 'taurus', 'gemini', 'cancer',
  'leo', 'virgo', 'libra', 'scorpio',
  'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

// ── 달 황도 경도 계산 (Meeus, Astronomical Algorithms 47장, 단축형) ──────────

function calcMoonLongitudeDeg(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;

  const L  = normalizeAngle(218.3164591 + 481267.88134236 * T - 0.0013268 * T * T + (T * T * T) / 538841 - (T * T * T * T) / 65194000);
  const Mm = normalizeAngle(134.9634114 + 477198.8676313 * T + 0.0089970 * T * T + (T * T * T) / 69699 - (T * T * T * T) / 14712000);
  const Ms = normalizeAngle(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + (T * T * T) / 24490000);
  const F  = normalizeAngle(93.2720993  + 483202.0175273 * T - 0.0034029 * T * T - (T * T * T) / 3526000 + (T * T * T * T) / 863310000);
  const D  = normalizeAngle(297.8502042 + 445267.1115168 * T - 0.0016300 * T * T + (T * T * T) / 545868 - (T * T * T * T) / 113065000);

  const sumL = (
    6288774 * Math.sin(Mm * DEG) +
    1274027 * Math.sin((2 * D - Mm) * DEG) +
    658314  * Math.sin(2 * D * DEG) +
    213618  * Math.sin(2 * Mm * DEG) +
    -185116 * Math.sin(Ms * DEG) +
    -114332 * Math.sin(2 * F * DEG) +
    58793   * Math.sin((2 * D - 2 * Mm) * DEG) +
    57066   * Math.sin((2 * D - Ms - Mm) * DEG) +
    53322   * Math.sin((2 * D + Mm) * DEG) +
    45758   * Math.sin((2 * D - Ms) * DEG) +
    -40923  * Math.sin((Mm - Ms) * DEG) +
    -34720  * Math.sin(D * DEG) +
    -30383  * Math.sin((Ms + Mm) * DEG) +
    15327   * Math.sin((2 * D - 2 * F) * DEG) +
    10980   * Math.sin((Mm - 2 * F) * DEG) +
    10675   * Math.sin((4 * D - Mm) * DEG) +
    10034   * Math.sin(3 * Mm * DEG) +
    8548    * Math.sin((4 * D - 2 * Mm) * DEG) +
    -7888   * Math.sin((2 * D + Ms - Mm) * DEG) +
    -6766   * Math.sin((2 * D + Ms) * DEG) +
    -5163   * Math.sin((Mm - D) * DEG) +
    4987    * Math.sin((D + Ms) * DEG) +
    4036    * Math.sin((2 * D - Ms + Mm) * DEG) +
    3994    * Math.sin((2 * D + 2 * Mm) * DEG) +
    3861    * Math.sin(4 * D * DEG) +
    3665    * Math.sin((2 * D - 3 * Mm) * DEG)
  );

  return normalizeAngle(L + sumL / 1_000_000);
}

// ── 상승궁 황도 경도 계산 ──────────────────────────────────────────────────────

function calcAscendantLongitudeDeg(jd: number, latDeg: number, lonDeg: number): number {
  const T = (jd - 2451545.0) / 36525.0;

  // 그리니치 항성시 (도)
  const GMST = normalizeAngle(
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000
  );

  const LST   = normalizeAngle(GMST + lonDeg);
  const RAMC  = LST; // 자오선 적경 (도)

  // 황도 경사각
  const eps = 23.4392911111 - 0.013004167 * T - 0.0000001639 * T * T + 0.0000005036 * T * T * T;

  const ramcR = RAMC * DEG;
  const latR  = latDeg * DEG;
  const epsR  = eps * DEG;

  const asc = Math.atan2(
    -Math.cos(ramcR),
    Math.sin(ramcR) * Math.cos(epsR) + Math.tan(latR) * Math.sin(epsR)
  ) / DEG;

  return normalizeAngle(asc);
}

// ── 메인 계산 함수 ─────────────────────────────────────────────────────────────

function makePlacement(planet: PlanetKey, signKey: ZodiacKey, degree?: number): WesternPlacement {
  const data = SIGN_DATA[signKey];
  const PLANET_META: Record<string, { symbol: string; label: string }> = {
    sun:       { symbol: '☉', label: '태양궁' },
    moon:      { symbol: '☽', label: '달궁' },
    ascendant: { symbol: '↑', label: '상승궁' },
  };
  const meta = PLANET_META[planet] ?? { symbol: '✦', label: planet };

  const descriptionMap: Record<PlanetKey, string> = {
    sun:       data.sunDescription,
    moon:      data.moonDescription,
    ascendant: data.ascendantDescription,
    mercury:   data.sunDescription,
    venus:     data.sunDescription,
    mars:      data.sunDescription,
    jupiter:   data.sunDescription,
    saturn:    data.sunDescription,
  };

  return {
    planet,
    planetSymbol: meta.symbol,
    planetLabel: meta.label,
    signKey,
    data,
    description: descriptionMap[planet],
    degree,
  };
}

/**
 * 서양점성술 분석 메인 함수
 *
 * @param birthdate  "YYYY-MM-DD"
 * @param birthtime  "HH:mm" 또는 "" (미입력)
 * @param birthLat   위도 (도). undefined → 상승궁 미계산
 * @param birthLon   경도 (도). undefined → 상승궁 미계산
 *
 * Swiss Ephemeris 연동 시: calcMoonLongitudeDeg / calcAscendantLongitudeDeg 를
 * 라이브러리 호출로 교체하면 됩니다. 외부 인터페이스(WesternAstrologyResult)는 그대로 유지됩니다.
 */
export function calcWesternAstrology(
  birthdate: string,
  birthtime: string,
  birthLat?: number,
  birthLon?: number,
): WesternAstrologyResult {
  const [year, month, day] = birthdate.split('-').map(Number);
  const hasTime = birthtime.length >= 4;
  const [hour, minute] = hasTime ? birthtime.split(':').map(Number) : [0, 0];

  // ── 태양궁 (날짜만으로 정확히 계산) ──────────────────────────────────────
  const sunKey = calcSunSignKey(month, day);
  const sunPlacement = makePlacement('sun', sunKey);

  // ── 달궁 (날짜+시간 필요, 근사) ──────────────────────────────────────────
  let moonPlacement: WesternPlacement | null = null;
  if (hasTime) {
    const jd = toJD(year, month, day, hour, minute);
    const moonLon = calcMoonLongitudeDeg(jd);
    const moonKey = SIGN_ORDER[longitudeToSignIndex(moonLon)];
    moonPlacement = makePlacement('moon', moonKey, moonLon % 30);
  }

  // ── 상승궁 (날짜+시간+위치 필요, 근사) ──────────────────────────────────
  let ascPlacement: WesternPlacement | null = null;
  if (hasTime && birthLat !== undefined && birthLon !== undefined) {
    const jd = toJD(year, month, day, hour, minute);
    const ascLon = calcAscendantLongitudeDeg(jd, birthLat, birthLon);
    const ascKey = SIGN_ORDER[longitudeToSignIndex(ascLon)];
    ascPlacement = makePlacement('ascendant', ascKey, ascLon % 30);
  }

  // ── 교집합 CoreTag 합산 ───────────────────────────────────────────────────
  const placements = [sunPlacement, moonPlacement, ascPlacement].filter((p): p is WesternPlacement => p !== null);
  const allTags = [...new Set(placements.flatMap((p) => p.data.coreTags))] as CoreTag[];
  const allKeywords = [...new Set(placements.flatMap((p) => p.data.keywords))];

  const dataLevel: AstroDataLevel =
    ascPlacement ? 'full' : moonPlacement ? 'sun-moon' : 'sun-only';

  return {
    sun: sunPlacement,
    moon: moonPlacement,
    ascendant: ascPlacement,
    dataLevel,
    coreTags: allTags,
    keywords: allKeywords,
    isApproximate: hasTime,
  };
}

/** 태양궁 키 반환 (월/일 기준, 경계일 처리 포함) */
export function calcSunSignKey(month: number, day: number): ZodiacKey {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  return 'pisces';
}

export { SIGN_DATA };
