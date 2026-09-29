// ── Palm Phase 1A: 손바닥 이미지 관찰 계약 ─────────────────────────────────
// 향후 vision provider가 만들어야 할 구조화 관찰이다 (docs/ai/CODEX_REVIEW.md "Palm Phase 1").
// 시각적 특징만 기록한다. 성격·수명·미래·건강 해석, CoreTag, provider 고유 개념을 담지 않는다.
// 손금 명칭은 선 후보를 구분하는 관례적 이름일 뿐이다.
// 숫자 confidence는 두지 않는다. 품질은 "관찰을 쓸 수 있는가"의 gate이지 해석 정확도가 아니다.

export type PalmLineKey = 'life' | 'head' | 'heart' | 'fate';

// Evidence 순서를 고정하는 선 순서
export const PALM_LINE_KEYS: readonly PalmLineKey[] = ['life', 'head', 'heart', 'fate'];

export type PalmReadabilityReason =
  | 'blur' | 'lighting' | 'cropped' | 'occluded'
  | 'perspective' | 'ambiguous-line' | 'not-visible';

export const PALM_READABILITY_REASONS: readonly PalmReadabilityReason[] =
  ['blur', 'lighting', 'cropped', 'occluded', 'perspective', 'ambiguous-line', 'not-visible'];

// 한 속성의 판독 결과: 읽혔으면 값, 시도했지만 읽지 못했으면 이유
export type PalmReading<T extends string> =
  | { status: 'observed'; value: T }
  | { status: 'unreadable'; reason: PalmReadabilityReason };

export type PalmCurvature = 'straight' | 'curved';
export type PalmContinuity = 'continuous' | 'interrupted';

export const PALM_CURVATURES: readonly PalmCurvature[] = ['straight', 'curved'];
export const PALM_CONTINUITIES: readonly PalmContinuity[] = ['continuous', 'interrupted'];

// visible:      선 후보가 보인다. 두 속성을 각각 판독한다 (하나만 읽힐 수 있음).
// not-detected: 충분히 보이는 영역에서 후보를 찾지 못했다는 관찰. 해부학적 부재 단언이 아니다.
// unreadable:   영역이 잘리거나 흐려 판독 자체를 할 수 없다. not-detected와 다르다.
export type PalmLineObservation =
  | {
      status: 'visible';
      curvature: PalmReading<PalmCurvature>;
      continuity: PalmReading<PalmContinuity>;
    }
  | { status: 'not-detected' }
  | { status: 'unreadable'; reason: PalmReadabilityReason };

// 네 line key는 모두 필수다. 읽지 못한 선도 명시적으로 unreadable이다.
export type PalmObservation = {
  version: 1;
  lines: Record<PalmLineKey, PalmLineObservation>;
};

export type PalmImageIssue =
  | 'blur' | 'lighting' | 'occlusion' | 'perspective'
  | 'cropped-palm' | 'multiple-hands' | 'not-a-palm';

export const PALM_IMAGE_ISSUES: readonly PalmImageIssue[] =
  ['blur', 'lighting', 'occlusion', 'perspective', 'cropped-palm', 'multiple-hands', 'not-a-palm'];

// 이미지 전체 품질. 관찰(lines)과 분리해 bundle에만 둔다 — Evidence가 되지 않는다.
export type PalmImageQuality = {
  version: 1;
  usability: 'usable' | 'partial' | 'unusable';
  palmCoverage: 'full' | 'partial' | 'none';
  issues: PalmImageIssue[];
};

// 추출 한 번의 결과 묶음. extraction 버전은 서버 설정에서 채운다 (모델 응답을 믿지 않음).
export type PalmObservationBundle = {
  version: 1;
  observation: PalmObservation;
  quality: PalmImageQuality;
  extraction: {
    adapterVersion: string;
    modelRevision: string;
    promptVersion: string;
  };
};
