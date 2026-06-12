// ============================================================
// 출생지 지역 데이터
// ============================================================
//
// - KOREA_REGIONS        : 대한민국 17개 시·도 (위도/경도 = 도청·시청 소재지 기준)
// - INTERNATIONAL_CITIES : 해외 주요 도시
// - LEGACY_LOCATION_ALIASES : 이전 버전 출생지 라벨 → 좌표 매핑 (하위 호환용)
// - findLocationByLabel  : 드롭다운 라벨로 좌표를 조회 (신규 + 레거시 모두 지원)
//
// 시/군/구 확장 방법:
//   RegionOption.districts 배열에 하위 지역을 추가하면,
//   findLocationByLabel 이 districts 까지 자동으로 탐색합니다.
//   예) KOREA_REGIONS.find(r => r.code === 'gyeonggi')!.districts = [
//     { code: 'gyeonggi-suwon', label: '수원시', lat: 37.2636, lon: 127.0286 },
//     { code: 'gyeonggi-goyang', label: '고양시', lat: 37.6584, lon: 126.8320 },
//   ];

export interface RegionOption {
  code: string;
  label: string;
  lat: number;
  lon: number;
  /** 향후 시/군/구 확장용 (선택) */
  districts?: RegionOption[];
}

// ── 대한민국 17개 시·도 ────────────────────────────────────────────────────────

export const KOREA_REGIONS: RegionOption[] = [
  { code: 'seoul',    label: '서울특별시',     lat: 37.5665, lon: 126.9780 },
  { code: 'busan',    label: '부산광역시',     lat: 35.1796, lon: 129.0756 },
  { code: 'daegu',    label: '대구광역시',     lat: 35.8714, lon: 128.6014 },
  { code: 'incheon',  label: '인천광역시',     lat: 37.4563, lon: 126.7052 },
  { code: 'gwangju',  label: '광주광역시',     lat: 35.1595, lon: 126.8526 },
  { code: 'daejeon',  label: '대전광역시',     lat: 36.3504, lon: 127.3845 },
  { code: 'ulsan',    label: '울산광역시',     lat: 35.5384, lon: 129.3114 },
  { code: 'sejong',   label: '세종특별자치시', lat: 36.4800, lon: 127.2890 },
  { code: 'gyeonggi', label: '경기도',         lat: 37.2750, lon: 127.0095 },
  { code: 'gangwon',  label: '강원특별자치도', lat: 37.8853, lon: 127.7298 },
  { code: 'chungbuk', label: '충청북도',       lat: 36.6357, lon: 127.4914 },
  { code: 'chungnam', label: '충청남도',       lat: 36.6010, lon: 126.6692 },
  { code: 'jeonbuk',  label: '전북특별자치도', lat: 35.8203, lon: 127.1086 },
  { code: 'jeonnam',  label: '전라남도',       lat: 34.8161, lon: 126.4630 },
  { code: 'gyeongbuk', label: '경상북도',      lat: 36.5759, lon: 128.5054 },
  { code: 'gyeongnam', label: '경상남도',      lat: 35.2376, lon: 128.6919 },
  { code: 'jeju',     label: '제주특별자치도', lat: 33.4996, lon: 126.5312 },
];

// ── 해외 주요 도시 ────────────────────────────────────────────────────────────

export const INTERNATIONAL_CITIES: RegionOption[] = [
  { code: 'tokyo',    label: '도쿄 (일본)',        lat: 35.6762,  lon: 139.6503 },
  { code: 'osaka',    label: '오사카 (일본)',      lat: 34.6937,  lon: 135.5023 },
  { code: 'newyork',  label: '뉴욕 (미국)',        lat: 40.7128,  lon: -74.0060 },
  { code: 'la',       label: '로스앤젤레스 (미국)', lat: 34.0522,  lon: -118.2437 },
  { code: 'london',   label: '런던 (영국)',        lat: 51.5074,  lon: -0.1278  },
  { code: 'beijing',  label: '베이징 (중국)',      lat: 39.9042,  lon: 116.4074 },
  { code: 'shanghai', label: '상하이 (중국)',      lat: 31.2304,  lon: 121.4737 },
  { code: 'sydney',   label: '시드니 (호주)',      lat: -33.8688, lon: 151.2093 },
  { code: 'vancouver', label: '밴쿠버 (캐나다)',   lat: 49.2827,  lon: -123.1207 },
  { code: 'toronto',  label: '토론토 (캐나다)',    lat: 43.6532,  lon: -79.3832  },
];

// ── 드롭다운 그룹 ─────────────────────────────────────────────────────────────

export const LOCATION_OPTION_GROUPS: { label: string; options: RegionOption[] }[] = [
  { label: '대한민국', options: KOREA_REGIONS },
  { label: '해외',     options: INTERNATIONAL_CITIES },
];

// ── 이전 버전 출생지 라벨 호환 ──────────────────────────────────────────────────
// 과거 CITY_OPTIONS에서 사용되던 짧은 지역명(예: '서울', '수원')을 그대로 둔 경우에도
// 동일한 좌표로 조회되도록 매핑합니다.

export const LEGACY_LOCATION_ALIASES: Record<string, { lat: number; lon: number }> = {
  '서울': { lat: 37.5665, lon: 126.9780 },
  '부산': { lat: 35.1796, lon: 129.0756 },
  '인천': { lat: 37.4563, lon: 126.7052 },
  '대구': { lat: 35.8714, lon: 128.6014 },
  '대전': { lat: 36.3504, lon: 127.3845 },
  '광주': { lat: 35.1595, lon: 126.8526 },
  '울산': { lat: 35.5384, lon: 129.3114 },
  '수원': { lat: 37.2636, lon: 127.0286 },
  '창원': { lat: 35.2280, lon: 128.6811 },
  '고양': { lat: 37.6584, lon: 126.8320 },
  '성남': { lat: 37.4200, lon: 127.1269 },
  '청주': { lat: 36.6424, lon: 127.4890 },
  '전주': { lat: 35.8242, lon: 127.1480 },
  '제주': { lat: 33.4996, lon: 126.5312 },
};

/** 드롭다운에 표시되는 라벨(신규/레거시 모두 포함)로 좌표를 조회합니다. */
export function findLocationByLabel(label: string): { lat: number; lon: number } | undefined {
  if (!label) return undefined;

  for (const region of KOREA_REGIONS) {
    if (region.label === label) return { lat: region.lat, lon: region.lon };
    const district = region.districts?.find((d) => d.label === label);
    if (district) return { lat: district.lat, lon: district.lon };
  }

  const intl = INTERNATIONAL_CITIES.find((c) => c.label === label);
  if (intl) return { lat: intl.lat, lon: intl.lon };

  return LEGACY_LOCATION_ALIASES[label];
}
