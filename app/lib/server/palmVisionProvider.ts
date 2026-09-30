import 'server-only';

// ── Palm Phase 1B: provider 중립 경계 ────────────────────────────────────────
// 준비된 이미지 한 장 → provider의 구조화 응답(신뢰하지 않는 unknown).
// provider SDK 타입은 이 경계를 넘지 않는다. 결과의 최종 검증은 항상 parsePalmObservationBundle()이다.

export type PreparedPalmImage = {
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
};

export interface PalmVisionProvider {
  // observation/quality payload 후보를 반환한다. PalmObservation으로 단언하지 않는다.
  extract(image: PreparedPalmImage, options: { signal: AbortSignal }): Promise<unknown>;
}

// provider 쪽 실패의 정규화된 종류. 원문 오류·응답 본문은 담지 않는다.
export type PalmProviderFailure = 'timeout' | 'provider-error' | 'invalid-response';

export class PalmProviderError extends Error {
  constructor(readonly failure: PalmProviderFailure) {
    super(`palm provider: ${failure}`);
    this.name = 'PalmProviderError';
  }
}
