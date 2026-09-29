import type { AnalysisOutput, AnalysisSnapshot } from './analysis';
import { generateDestinyCode } from './destinyCode';
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
