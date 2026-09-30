import type { PalmLineKey, PalmLineObservation, PalmObservationBundle, PalmReadabilityReason } from './palmObservation';
import { PALM_LINE_KEYS } from './palmObservation';

// ── Palm Phase 1C: 사용자 표시용 문구 (순수 함수) ─────────────────────────────
// 기술 JSON·rule ID·provider metadata·confidence는 표시하지 않는다.
// 선 이름은 관례적 명칭이며 일상 설명을 병기한다. 수명·건강·성공·미래를 단정하지 않는다.

export const PALM_DISCLAIMER = '손바닥 분석은 AI 기반의 해석적 콘텐츠이며 과학적·의학적 판단이나 미래 예측을 제공하지 않습니다.';
export const PALM_PROCESSING_NOTICE_TEXT = '선택한 사진은 손바닥 관찰을 위해 OpenAI로 전송됩니다. 서비스는 원본 사진을 별도로 저장하지 않습니다. 결과를 저장하면 관찰·해석은 이 기기에 보관됩니다.';
export const PALM_PROCESSING_NOTICE_DETAILS = [
  '이름·생년월일·MBTI 등 기존 입력값은 사진과 함께 보내지 않습니다.',
  '외부 AI 서비스에는 해당 서비스의 데이터 처리 정책이 적용됩니다. 어디에도 저장되지 않는다는 뜻은 아닙니다.',
  '서비스 개선을 위한 사진 보관은 현재 하지 않습니다.',
];
export const PALM_SHARE_NOTE = '공유에는 기본 운명 코드 결과만 포함됩니다.';
export const PALM_NO_BASIS_NOTE = '이 저장 결과에는 비교 기준이 없어 손바닥 해석만 표시합니다.';
export const PALM_MATCH_NOTE = '겹침은 정확도 인증이 아니라, 두 상징적 해석이 같은 방향을 가리킨다는 뜻입니다.';

export const PALM_LINE_LABELS: Record<PalmLineKey, { name: string; hint: string }> = {
  life: { name: '생명선', hint: '엄지 쪽을 감싸는 선 후보' },
  head: { name: '두뇌선', hint: '손바닥 중앙을 가로지르는 선 후보' },
  heart: { name: '감정선', hint: '손가락 아래 가로 선 후보' },
  fate: { name: '운명선', hint: '손바닥 가운데 세로 선 후보' },
};

const REASONS: Record<PalmReadabilityReason, string> = {
  blur: '흐림', lighting: '조명', cropped: '사진에서 잘림', occluded: '가려짐',
  perspective: '촬영 각도', 'ambiguous-line': '선 구분이 어려움', 'not-visible': '보이지 않음',
};

export type PalmObservationRow = { line: PalmLineKey; name: string; hint: string; summary: string; readable: boolean };

function describe(o: PalmLineObservation): { summary: string; readable: boolean } {
  if (o.status === 'not-detected') return { summary: '뚜렷한 선 후보를 찾지 못했습니다', readable: true };
  if (o.status === 'unreadable') return { summary: `판독하기 어려움 (${REASONS[o.reason]})`, readable: false };
  const curve = o.curvature.status === 'observed' ? (o.curvature.value === 'straight' ? '곧은 흐름' : '굽은 흐름') : `곡선 판독 어려움(${REASONS[o.curvature.reason]})`;
  const cont = o.continuity.status === 'observed' ? (o.continuity.value === 'continuous' ? '이어진 선' : '나뉘어 보이는 선') : `연결 판독 어려움(${REASONS[o.continuity.reason]})`;
  return { summary: `보임 · ${curve} · ${cont}`, readable: true };
}

export function palmObservationRows(bundle: PalmObservationBundle): PalmObservationRow[] {
  return PALM_LINE_KEYS.map((line) => ({ line, ...PALM_LINE_LABELS[line], ...describe(bundle.observation.lines[line]) }));
}

export function palmQualityNote(bundle: PalmObservationBundle): string | null {
  if (bundle.quality.usability === 'unusable') return '이 사진에서는 손바닥 선을 판독하기 어려웠습니다. 안내에 맞춰 다른 사진을 선택해 주세요.';
  if (bundle.quality.usability === 'partial') return '사진 일부만 판독되어, 읽힌 부분만 표시합니다.';
  return null;
}

// ── 로컬 파일 사전 안내 (서버 검증을 대체하지 않는다) ──
export const PALM_ACCEPT = 'image/jpeg,image/png,image/webp';
export const PALM_MAX_BYTES = 4_000_000;
export type PalmFileProblem = 'heic' | 'type' | 'size' | 'empty';

export function checkPalmFile(file: { type: string; name: string; size: number }): PalmFileProblem | null {
  const type = file.type.toLowerCase();
  if (/^image\/hei[cf]/.test(type) || /\.hei[cf]$/i.test(file.name)) return 'heic';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return 'type';
  if (file.size === 0) return 'empty';
  if (file.size > PALM_MAX_BYTES) return 'size';
  return null;
}

export const PALM_FILE_MESSAGES: Record<PalmFileProblem, string> = {
  heic: 'HEIC/HEIF 사진은 아직 지원하지 않습니다. JPEG·PNG·WebP 사진을 선택하거나, iPhone은 설정 > 카메라 > 포맷에서 "높은 호환성"으로 촬영해 주세요.',
  type: 'JPEG·PNG·WebP 사진만 분석할 수 있습니다.',
  size: '사진이 너무 큽니다. 4MB 이하 사진을 선택해 주세요.',
  empty: '사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.',
};

// 서버 오류 code → 사용자 문구. 원문 오류는 표시하지 않는다.
export function palmErrorMessage(code: string | null): string {
  switch (code) {
    case 'INVALID_IMAGE': return '지원하지 않는 형식이거나 사진을 읽을 수 없습니다. JPEG·PNG·WebP 사진으로 다시 선택해 주세요.';
    case 'IMAGE_TOO_LARGE': return '사진이 너무 크거나 해상도가 지원 범위를 넘습니다. 4MB 이하 사진을 선택해 주세요.';
    case 'RATE_LIMITED': return '지금은 요청이 많아 분석할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    case 'DUPLICATE_IMAGE': return '같은 사진은 방금 분석했습니다. 다른 사진을 선택하거나 잠시 후 다시 시도해 주세요.';
    case 'DUPLICATE_REQUEST':
    case 'REQUEST_CONFLICT':
    case 'PROVIDER_TIMEOUT':
    case 'NETWORK': return '결과를 받지 못했습니다. 다시 시도하면 새 요청으로 처리됩니다.';
    case 'PROVIDER_ERROR':
    case 'INVALID_PROVIDER_RESPONSE': return '지금은 손바닥 분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    case 'SESSION_REQUIRED': return '연결이 만료되었습니다. 다시 시도해 주세요.';
    default: return '지금은 손바닥 분석을 이용할 수 없습니다.';
  }
}
