import type { EvidenceRecord } from './evidenceTrace';
import {
  PALM_LINE_KEYS,
  parsePalmObservationBundle,
  type PalmLineKey,
  type PalmObservationBundle,
} from './palmObservation';

// ── Palm Phase 1A: PalmObservationBundle → EvidenceRecord[] ────────────────
// 순수 함수: 시간·난수·네트워크·provider 없이 같은 bundle에서 항상 같은 Evidence를 만든다.
// 시각 관찰만 옮긴다. InterpretationClaim·CoreTag·성격 해석은 만들지 않는다.
// 이미지 품질(quality)은 Evidence가 아니다 — unusable이면 Palm Evidence를 만들지 않는 gate로만 쓴다.
// 입력은 먼저 parsePalmObservationBundle()로 전체 검증한다 (유일한 검증 경계). 계약 위반이면
// PalmObservationContractError가 나고 Evidence는 한 행도 만들어지지 않는다.
//
// 순서: life, head, heart, fate × visibility, curvature, continuity
// id:      palm:line:<key>:<attribute>     feature: line.<key>.<attribute>
// value:   available → 판독된 enum 값 / missing·unreadable → null (기본값을 채우지 않음)
//   visible       visibility=visible, 각 속성은 observed→available, unreadable→unreadable
//   not-detected  visibility=not-detected(available), 속성은 적용되지 않으므로 missing
//   unreadable    visibility·속성 모두 unreadable

const ATTRIBUTES = ['visibility', 'curvature', 'continuity'] as const;
type Attribute = (typeof ATTRIBUTES)[number];

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
export function buildPalmEvidence(input: PalmObservationBundle | undefined): EvidenceRecord[] {
  if (input === undefined) return [];
  const bundle = parsePalmObservationBundle(input); // 전체 검증이 끝난 뒤에만 행을 만든다
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
