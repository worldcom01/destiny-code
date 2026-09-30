import { isAnalysisSnapshot, type AnalysisOutput, type AnalysisSnapshot } from './analysis';
import { generateDestinyCode } from './destinyCode';
import { baseTraitsOf, buildSupplementaryComparison } from './palmComparison';
import { buildPalmInterpretation } from './palmInterpretation';
import type { PalmObservationBundle } from './palmObservation';
import {
  PALM_PROCESSING_NOTICE_VERSION,
  PALM_SUPPLEMENT_VERSION,
  type PalmBaseRef,
  type PalmSupplement,
} from './palmSupplement';
import { generateShareText } from './shareEngine';
import { saveAnalysis, type SavedAnalysis, type SavedAnalysisMeta } from './storageEngine';

// 화면에 표시 중인 분석 결과와 그 결과에 속한 메타데이터.
// 공유·재저장·운명 코드는 현재 입력 폼이 아니라 항상 이 값에서 가져온다.
export interface ActiveAnalysis {
  result: AnalysisSnapshot | AnalysisOutput;
  meta: SavedAnalysisMeta;
  savedId?: string; // 저장 목록에서 연 경우 원래 항목 ID
}

// 새 분석 — 메타데이터는 분석 시점의 입력값으로 고정한다.
export function activeFromNewAnalysis(
  result: AnalysisSnapshot,
  input: Pick<SavedAnalysisMeta, 'nickname' | 'birthdate' | 'mbti' | 'bloodtype'>,
): ActiveAnalysis {
  return {
    result,
    meta: {
      ...input,
      keywords: result.commonKeywords,
      tarotName: result.tarot.name,
      zodiacSign: result.zodiac.sign,
    },
  };
}

// 저장된 결과 — 저장 당시 메타데이터를 그대로 쓴다. 없는 값을 채워 넣지 않는다.
export function activeFromSaved(saved: SavedAnalysis): ActiveAnalysis {
  const { nickname, birthdate, mbti, bloodtype, keywords, tarotName, zodiacSign } = saved;
  return {
    result: saved.resultData,
    meta: { nickname, birthdate, mbti, bloodtype, keywords, tarotName, zodiacSign },
    savedId: saved.id,
  };
}

export function activeDestinyCode(active: ActiveAnalysis): string {
  return generateDestinyCode(active.result);
}

export function activeShareText(active: ActiveAnalysis): string {
  return generateShareText(active.result, active.meta.nickname);
}

export function saveActive(active: ActiveAnalysis): SavedAnalysis {
  return saveAnalysis(active.meta, active.result, active.savedId);
}

// Palm 보조 기록의 연결 키 — 이 결과 자체에서만 만든다 (입력 폼·Destiny Code·닉네임 사용 안 함).
// snapshot은 analysisId, legacy는 저장 목록 ID. savedId 없는 legacy 임시 결과에는 부착하지 않는다.
export function activeBaseRef(active: ActiveAnalysis): PalmBaseRef | null {
  if (isAnalysisSnapshot(active.result)) return { kind: 'snapshot', id: active.result.analysisId };
  return active.savedId ? { kind: 'legacy', id: active.savedId } : null;
}

// Palm 관찰 → 이 결과에 속한 supplement. 비교 기준은 이 결과에 저장된 coreTags뿐이다.
// base 결과 객체는 읽기만 하고 변경하지 않는다.
export function buildPalmSupplementFor(
  active: ActiveAnalysis,
  bundle: PalmObservationBundle,
  opts: { id: string; createdAt: string; noticeAcceptedAt: string },
): PalmSupplement | null {
  const baseRef = activeBaseRef(active);
  if (!baseRef) return null;
  const interpretation = buildPalmInterpretation(bundle);
  return {
    version: PALM_SUPPLEMENT_VERSION,
    id: opts.id,
    baseRef,
    createdAt: opts.createdAt,
    bundle,
    interpretation,
    comparison: buildSupplementaryComparison(interpretation, baseTraitsOf(active.result)),
    processingNotice: { version: PALM_PROCESSING_NOTICE_VERSION, acceptedAt: opts.noticeAcceptedAt },
    retention: 'derived-local-only',
  };
}
