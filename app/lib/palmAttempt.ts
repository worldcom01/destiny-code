import { sameBaseRef, type PalmBaseRef } from './palmSupplement';

// 요청 시작 시 캡처한 (baseRef, attemptId)와 응답 도착 시의 현재 값이 모두 같을 때만 결과를 반영한다.
// A 처리 중 B 열기·새 분석·삭제·더 늦게 도착한 이전 retry 응답은 모두 버린다.
export type PalmAttemptContext = { baseRef: PalmBaseRef | null; attemptId: string | null };

export function isCurrentPalmAttempt(captured: PalmAttemptContext, current: PalmAttemptContext): boolean {
  return captured.attemptId !== null && captured.attemptId === current.attemptId && sameBaseRef(captured.baseRef, current.baseRef);
}

// panel 인스턴스(결과 하나)마다 하나. unmount·삭제 시 invalidate() → 진행 중 시도의 응답은 모두 버려진다.
export class PalmAttemptTracker {
  private attemptId: string | null = null;

  begin(baseRef: PalmBaseRef | null, attemptId: string): PalmAttemptContext {
    this.attemptId = attemptId;
    return { baseRef, attemptId };
  }

  invalidate(): void {
    this.attemptId = null;
  }

  isCurrent(captured: PalmAttemptContext, baseRefNow: PalmBaseRef | null): boolean {
    return isCurrentPalmAttempt(captured, { baseRef: baseRefNow, attemptId: this.attemptId });
  }
}

// 저장 목록에서 지운 결과가 지금 화면의 결과면 그 결과의 Palm 상태(진행 중 요청·미저장 결과·미리보기)를 모두 버린다.
// 다른 결과를 지운 경우에는 현재 결과의 Palm 상태를 건드리지 않는다.
export function shouldResetPalmOnDelete(activeRef: PalmBaseRef | null, deletedRef: PalmBaseRef): boolean {
  return sameBaseRef(activeRef, deletedRef);
}
