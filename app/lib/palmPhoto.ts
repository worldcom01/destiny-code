// ── Palm V2: 브라우저에서 사진을 업로드용 JPEG로 정리 ───────────────────────────
// 기기가 디코딩할 수 있는 사진(iPhone HEIC 포함)을 긴 변 2048px 이하 JPEG로 다시 그린다.
// EXIF·위치 정보는 다시 그리는 과정에서 빠진다. 원본은 어디에도 저장하지 않는다.

const MAX_EDGE = 2048;
const MAX_INPUT_BYTES = 25_000_000;

export type PalmPhotoError = 'too-large' | 'unreadable';

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // 일부 Safari는 HEIC를 createImageBitmap으로 못 열지만 <img>로는 연다
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export async function normalizePalmPhoto(file: File): Promise<{ ok: true; blob: Blob } | { ok: false; error: PalmPhotoError }> {
  if (file.size === 0) return { ok: false, error: 'unreadable' };
  if (file.size > MAX_INPUT_BYTES) return { ok: false, error: 'too-large' };
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    return { ok: false, error: 'unreadable' };
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
    const w = Math.max(1, Math.round(decoded.width * scale));
    const h = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: 'unreadable' };
    ctx.drawImage(decoded.source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob || blob.size === 0) return { ok: false, error: 'unreadable' };
    if (blob.size > 4_000_000) return { ok: false, error: 'too-large' };
    return { ok: true, blob };
  } finally {
    decoded.close();
  }
}

export const PALM_PHOTO_ERROR_TEXT: Record<PalmPhotoError, string> = {
  'too-large': '사진이 너무 큽니다. 다른 사진을 선택해 주세요.',
  unreadable: '이 사진을 열 수 없습니다. 다른 사진을 선택하거나 카메라로 촬영해 주세요.',
};
