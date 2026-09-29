import type { EvidenceRecord } from './evidenceTrace';
import {
  PALM_CONTINUITIES,
  PALM_CURVATURES,
  PALM_LINE_KEYS,
  PALM_READABILITY_REASONS,
  type PalmLineKey,
  type PalmObservationBundle,
} from './palmObservation';

// ── Palm Phase 1A: PalmObservationBundle → EvidenceRecord[] ────────────────
// 순수 함수: 시간·난수·네트워크·provider 없이 같은 bundle에서 항상 같은 Evidence를 만든다.
// 시각 관찰만 옮긴다. InterpretationClaim·CoreTag·성격 해석은 만들지 않는다.
// 이미지 품질(quality)은 Evidence가 아니다 — unusable이면 Palm Evidence를 만들지 않는 gate로만 쓴다.
//
// 순서: life, head, heart, fate × visibility, curvature, continuity
// id:      palm:line:<key>:<attribute>     feature: line.<key>.<attribute>
// value:   available → 판독된 enum 값 / missing·unreadable → null (기본값을 채우지 않음)
//   visible       visibility=visible, 각 속성은 observed→available, unreadable→unreadable
//   not-detected  visibility=not-detected(available), 속성은 적용되지 않으므로 missing
//   unreadable    visibility·속성 모두 unreadable

const ATTRIBUTES = ['visibility', 'curvature', 'continuity'] as const;
type Attribute = (typeof ATTRIBUTES)[number];

// 계약을 벗어난 입력은 보정하지 않고 거부한다 (가짜 관찰을 만들지 않기 위해).
export class PalmObservationContractError extends Error {
  constructor(message: string) {
    super(`palm observation contract: ${message}`);
    this.name = 'PalmObservationContractError';
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkReading(line: PalmLineKey, attr: 'curvature' | 'continuity', reading: unknown, values: readonly string[]) {
  if (!isObject(reading)) throw new PalmObservationContractError(`${line}.${attr} is not a reading`);
  if (reading.status === 'observed') {
    if (!values.includes(reading.value as string)) throw new PalmObservationContractError(`${line}.${attr} has invalid value ${String(reading.value)}`);
  } else if (reading.status === 'unreadable') {
    if (!PALM_READABILITY_REASONS.includes(reading.reason as never)) throw new PalmObservationContractError(`${line}.${attr} has invalid reason`);
  } else {
    throw new PalmObservationContractError(`${line}.${attr} has invalid status ${String(reading.status)}`);
  }
}

// adapter가 읽는 필드만 확인한다. 전체 응답 검증(unknown fields, quality·관찰 모순 거부 등)은 서버 validator 단계의 책임이다.
function checkBundle(bundle: unknown): asserts bundle is PalmObservationBundle {
  if (!isObject(bundle) || bundle.version !== 1) throw new PalmObservationContractError('bundle version must be 1');
  const { observation, quality } = bundle;
  if (!isObject(quality) || quality.version !== 1 || !['usable', 'partial', 'unusable'].includes(quality.usability as string)) {
    throw new PalmObservationContractError('quality is missing or invalid');
  }
  if (!isObject(observation) || observation.version !== 1 || !isObject(observation.lines)) {
    throw new PalmObservationContractError('observation is missing or invalid');
  }
  const lines = observation.lines;
  for (const key of Object.keys(lines)) {
    if (!PALM_LINE_KEYS.includes(key as PalmLineKey)) throw new PalmObservationContractError(`unknown line ${key}`);
  }
  for (const key of PALM_LINE_KEYS) {
    const line = lines[key];
    if (!isObject(line)) throw new PalmObservationContractError(`line ${key} is required`);
    if (line.status === 'visible') {
      checkReading(key, 'curvature', line.curvature, PALM_CURVATURES);
      checkReading(key, 'continuity', line.continuity, PALM_CONTINUITIES);
    } else if (line.status === 'not-detected') {
      if ('curvature' in line || 'continuity' in line) throw new PalmObservationContractError(`not-detected line ${key} cannot have attributes`);
    } else if (line.status === 'unreadable') {
      if (!PALM_READABILITY_REASONS.includes(line.reason as never)) throw new PalmObservationContractError(`line ${key} has invalid reason`);
    } else {
      throw new PalmObservationContractError(`line ${key} has invalid status ${String(line.status)}`);
    }
  }
}

function record(key: PalmLineKey, attr: Attribute, value: string | null, status: EvidenceRecord['status']): EvidenceRecord {
  return {
    id: `palm:line:${key}:${attr}`,
    source: 'palm',
    kind: 'image-observation',
    feature: `line.${key}.${attr}`,
    value,
    status,
  };
}

// 이미지가 없으면(undefined) Palm Evidence는 0개다. 없는 관찰을 missing 행으로 만들지 않는다.
export function buildPalmEvidence(bundle: PalmObservationBundle | undefined): EvidenceRecord[] {
  if (bundle === undefined) return [];
  checkBundle(bundle);
  if (bundle.quality.usability === 'unusable') return [];

  const evidence: EvidenceRecord[] = [];
  for (const key of PALM_LINE_KEYS) {
    const line = bundle.observation.lines[key];
    if (line.status === 'visible') {
      evidence.push(record(key, 'visibility', 'visible', 'available'));
      for (const attr of ['curvature', 'continuity'] as const) {
        const reading = line[attr];
        evidence.push(reading.status === 'observed'
          ? record(key, attr, reading.value, 'available')
          : record(key, attr, null, 'unreadable'));
      }
    } else if (line.status === 'not-detected') {
      evidence.push(record(key, 'visibility', 'not-detected', 'available'));
      evidence.push(record(key, 'curvature', null, 'missing'));
      evidence.push(record(key, 'continuity', null, 'missing'));
    } else {
      for (const attr of ATTRIBUTES) evidence.push(record(key, attr, null, 'unreadable'));
    }
  }
  return evidence;
}
