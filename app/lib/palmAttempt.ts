import { sameBaseRef, type PalmBaseRef } from './palmSupplement';

// 요청 시작 시 캡처한 (baseRef, attemptId)와 응답 도착 시의 현재 값이 모두 같을 때만 결과를 반영한다.
// A 처리 중 B 열기·새 분석·삭제·더 늦게 도착한 이전 retry 응답은 모두 버린다.
export type PalmAttemptContext = { baseRef: PalmBaseRef | null; attemptId: string | null };

export function isCurrentPalmAttempt(captured: PalmAttemptContext, current: PalmAttemptContext): boolean {
  return captured.attemptId !== null && captured.attemptId === current.attemptId && sameBaseRef(captured.baseRef, current.baseRef);
}
