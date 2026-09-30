import { ensurePalmSession } from './palmClient';

// ── Palm Phase 1C: 최소 analytics (허용 목록) ─────────────────────────────────
// 클라이언트는 표시·시작·재시도 세 가지만 보낸다. 성공/판독 불가/오류는 서버가 기록한다.
// 보내는 필드는 event 이름과 random event ID뿐 — 사진·해시·관찰·해석·trait·결과 ID·Destiny Code·
// 닉네임·파일명은 보내지 않는다. 실패는 조용히 무시하고 UI를 막지 않는다.
// 기존 saveAnalyticsResult()에는 Palm을 넣지 않는다.

export type PalmClientEvent = 'palm_prompt_viewed' | 'palm_started' | 'palm_retry';

export function trackPalmEvent(event: PalmClientEvent): void {
  void ensurePalmSession().then((s) => {
    if (!s.enabled) return;
    return fetch('/api/palm/events', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'content-type': 'application/json', 'x-palm-csrf': s.csrfToken },
      body: JSON.stringify({ eventId: crypto.randomUUID(), event }),
    });
  }).catch(() => undefined);
}
