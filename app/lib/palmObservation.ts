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

// ── 런타임 검증 경계 ────────────────────────────────────────────────────────
// 신뢰할 수 없는 입력(향후 provider의 구조화 응답 등) → 검증된 PalmObservationBundle.
// Palm 관찰의 유효성 정의는 여기 한 곳뿐이다. Evidence adapter도 이 함수를 거친다.
// 모든 단계에서 정확한 key 집합을 요구하고, 판별 상태와 모순되는 필드는 무시하지 않고 거부한다.
// 없는 값을 채우거나 모순 필드를 버리는 정규화는 하지 않는다. 입력은 변경하지 않으며 새 객체를 반환한다.

export class PalmObservationContractError extends Error {
  constructor(message: string) {
    super(`palm observation contract: ${message}`);
    this.name = 'PalmObservationContractError';
  }
}

const fail = (message: string): never => {
  throw new PalmObservationContractError(message);
};

function record(input: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail(`${path} must be an object`);
  const obj = input as Record<string, unknown>;
  const actual = Object.keys(obj).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) {
    fail(`${path} must have exactly the fields [${expected.join(', ')}], got [${actual.join(', ')}]`);
  }
  return obj;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(value as T)) fail(`${path} has invalid value ${JSON.stringify(value)}`);
  return value as T;
}

function status(input: unknown, path: string): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail(`${path} must be an object`);
  return (input as Record<string, unknown>).status;
}

function parseReading<T extends string>(input: unknown, allowed: readonly T[], path: string): PalmReading<T> {
  const s = status(input, path);
  if (s === 'observed') {
    const r = record(input, path, ['status', 'value']);
    return { status: 'observed', value: oneOf(r.value, allowed, `${path}.value`) };
  }
  if (s === 'unreadable') {
    const r = record(input, path, ['status', 'reason']);
    return { status: 'unreadable', reason: oneOf(r.reason, PALM_READABILITY_REASONS, `${path}.reason`) };
  }
  return fail(`${path}.status has invalid value ${JSON.stringify(s)}`);
}

function parseLine(input: unknown, path: string): PalmLineObservation {
  const s = status(input, path);
  if (s === 'visible') {
    const r = record(input, path, ['status', 'curvature', 'continuity']);
    return {
      status: 'visible',
      curvature: parseReading(r.curvature, PALM_CURVATURES, `${path}.curvature`),
      continuity: parseReading(r.continuity, PALM_CONTINUITIES, `${path}.continuity`),
    };
  }
  if (s === 'not-detected') {
    record(input, path, ['status']);
    return { status: 'not-detected' };
  }
  if (s === 'unreadable') {
    const r = record(input, path, ['status', 'reason']);
    return { status: 'unreadable', reason: oneOf(r.reason, PALM_READABILITY_REASONS, `${path}.reason`) };
  }
  return fail(`${path}.status has invalid value ${JSON.stringify(s)}`);
}

function parseQuality(input: unknown): PalmImageQuality {
  const r = record(input, 'quality', ['version', 'usability', 'palmCoverage', 'issues']);
  if (r.version !== 1) fail('quality.version must be 1');
  if (!Array.isArray(r.issues)) fail('quality.issues must be an array');
  const issues = (r.issues as unknown[]).map((v, i) => oneOf(v, PALM_IMAGE_ISSUES, `quality.issues[${i}]`));
  if (new Set(issues).size !== issues.length) fail('quality.issues has duplicates');
  return {
    version: 1,
    usability: oneOf(r.usability, ['usable', 'partial', 'unusable'] as const, 'quality.usability'),
    palmCoverage: oneOf(r.palmCoverage, ['full', 'partial', 'none'] as const, 'quality.palmCoverage'),
    issues,
  };
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${path} must be a non-empty string`);
  return value as string;
}

export function parsePalmObservationBundle(input: unknown): PalmObservationBundle {
  const b = record(input, 'bundle', ['version', 'observation', 'quality', 'extraction']);
  if (b.version !== 1) fail('bundle.version must be 1');

  const o = record(b.observation, 'observation', ['version', 'lines']);
  if (o.version !== 1) fail('observation.version must be 1');
  const rawLines = record(o.lines, 'observation.lines', PALM_LINE_KEYS);
  const lines = {} as Record<PalmLineKey, PalmLineObservation>;
  for (const key of PALM_LINE_KEYS) lines[key] = parseLine(rawLines[key], `lines.${key}`);

  const quality = parseQuality(b.quality);
  // 품질과 관찰의 명백한 모순 (설계 §3): 손바닥이 없거나 사용할 수 없는 이미지에서 관찰된 선은 없다
  if (quality.palmCoverage === 'none' && quality.usability !== 'unusable') fail('quality with no palm coverage must be unusable');
  if (quality.usability === 'unusable') {
    for (const key of PALM_LINE_KEYS) {
      if (lines[key].status !== 'unreadable') fail(`unusable image cannot have a ${lines[key].status} line (${key})`);
    }
  }

  const e = record(b.extraction, 'extraction', ['adapterVersion', 'modelRevision', 'promptVersion']);
  return {
    version: 1,
    observation: { version: 1, lines },
    quality,
    extraction: {
      adapterVersion: nonEmptyString(e.adapterVersion, 'extraction.adapterVersion'),
      modelRevision: nonEmptyString(e.modelRevision, 'extraction.modelRevision'),
      promptVersion: nonEmptyString(e.promptVersion, 'extraction.promptVersion'),
    },
  };
}
