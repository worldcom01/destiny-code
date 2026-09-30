import 'server-only';
import sharp, { type Metadata } from 'sharp';
import type { PreparedPalmImage } from './palmVisionProvider';

// ── Palm Phase 1B: 업로드 이미지 검증·준비 ─────────────────────────────────
// 한 장의 raw image body → 검증 → 방향 정정·metadata 제거·필요 시 한 번 축소 → sRGB JPEG.
// 메모리 buffer만 사용하고 파일을 쓰지 않는다. 입력 buffer는 변경하지 않는다.
// 선을 바꿀 수 있는 처리(sharpen, 대비, denoise, crop, 원근 보정, 생성형 보정, 확대)는 하지 않는다.

export const PALM_IMAGE_LIMITS = {
  maxInputBytes: 4_000_000,     // Vercel 4.5 MB payload 한도 아래
  minShortSide: 640,            // 방향 정정 후
  maxPixels: 20_000_000,
  maxSide: 8_000,
  maxPreparedLongSide: 2_048,
  maxPreparedBytes: 2_000_000,
  decodeTimeoutSeconds: 3,
} as const;

export const PALM_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PalmInputMime = (typeof PALM_ALLOWED_MIME)[number];

// unsupported → 415, invalid → 422, empty·upload-failed → 400, too-large → 413
// upload-failed: 업로드가 전체 deadline 안에 끝나지 않았거나, 요청이 취소되었거나, 본문 stream이 오류로 끝남
export type PalmImageFailure = 'unsupported' | 'invalid' | 'empty' | 'too-large' | 'upload-failed';

export class PalmImageError extends Error {
  constructor(readonly failure: PalmImageFailure) {
    super(`palm image: ${failure}`);
    this.name = 'PalmImageError';
  }
}

// body를 limit까지만 읽는다. 선언된 Content-Length가 아니라 실제 누적 byte로 강제한다.
// signal이 abort되면 reader를 취소한다(대기 중인 read가 즉시 끝남). 이 함수는 읽기 루프가 끝나고
// lock이 풀린 뒤에만 반환하므로, 반환 이후 이 요청의 본문을 계속 소비하는 작업은 남지 않는다.
// (애플리케이션 stream 취소이며, 플랫폼의 socket 종료 시점까지 보장하지는 않는다.)
export async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal,
): Promise<Uint8Array> {
  if (!body) throw new PalmImageError('empty');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  // cancel()의 source 정리 완료는 기다리지 않는다(무한 대기 방지). 대기 중인 read는 cancel 즉시 done으로 끝난다.
  const cancel = () => { reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    if (signal.aborted) cancel();
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        throw new PalmImageError('upload-failed'); // 본문 stream 오류 (연결 끊김 등)
      }
      if (signal.aborted) throw new PalmImageError('upload-failed');
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) {
        cancel();
        throw new PalmImageError('too-large');
      }
      chunks.push(chunk.value);
    }
  } catch (e) {
    chunks.length = 0; // 이미 받은 이미지 조각 참조 해제
    throw e;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
  if (total === 0) throw new PalmImageError('empty');
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}

const startsWith = (bytes: Uint8Array, sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
const ascii = (bytes: Uint8Array, at: number, len: number) => String.fromCharCode(...bytes.subarray(at, at + len));

export function detectPalmImageFormat(bytes: Uint8Array): PalmInputMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  return null;
}

// APNG(acTL)·animated WebP(ANIM/ANMF) chunk가 있으면 애니메이션이다. 첫 frame만 취하지 않고 거부한다.
function hasAnimationChunk(bytes: Uint8Array, mime: PalmInputMime): boolean {
  if (mime === 'image/png') {
    for (let at = 8; at + 8 <= bytes.length;) {
      const len = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
      const type = ascii(bytes, at + 4, 4);
      if (type === 'acTL') return true;
      if (type === 'IDAT' || type === 'IEND') return false;
      at += 12 + len;
    }
    return false;
  }
  if (mime === 'image/webp') {
    for (let at = 12; at + 8 <= bytes.length;) {
      const type = ascii(bytes, at, 4);
      const len = (bytes[at + 4] | (bytes[at + 5] << 8) | (bytes[at + 6] << 16) | (bytes[at + 7] << 24)) >>> 0;
      if (type === 'ANIM' || type === 'ANMF') return true;
      at += 8 + len + (len % 2);
    }
  }
  return false;
}

const SHARP_FORMAT: Record<PalmInputMime, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };

export async function preparePalmImage(input: Uint8Array, declaredMime: string): Promise<PreparedPalmImage> {
  const L = PALM_IMAGE_LIMITS;
  if (!(PALM_ALLOWED_MIME as readonly string[]).includes(declaredMime)) throw new PalmImageError('unsupported');
  if (input.byteLength === 0) throw new PalmImageError('empty');
  if (input.byteLength > L.maxInputBytes) throw new PalmImageError('too-large');
  const mime = detectPalmImageFormat(input);
  if (mime !== declaredMime) throw new PalmImageError('unsupported'); // signature와 MIME이 일치해야 한다
  if (hasAnimationChunk(input, mime)) throw new PalmImageError('invalid');

  const options = { limitInputPixels: L.maxPixels, failOn: 'warning' as const, animated: false };
  let meta: Metadata;
  try {
    // header만 읽는다(pixel decode 없음). 크기 상한은 아래에서 직접 판정해 too-large로 구분한다.
    meta = await sharp(input, { ...options, limitInputPixels: false }).metadata();
  } catch {
    throw new PalmImageError('invalid');
  }
  if (meta.format !== SHARP_FORMAT[mime]) throw new PalmImageError('unsupported');
  if ((meta.pages ?? 1) !== 1) throw new PalmImageError('invalid');
  if (meta.width > L.maxSide || meta.height > L.maxSide || meta.width * meta.height > L.maxPixels) {
    throw new PalmImageError('too-large');
  }
  const oriented = meta.autoOrient;
  if (Math.min(oriented.width, oriented.height) < L.minShortSide) throw new PalmImageError('invalid');

  try {
    if (meta.hasAlpha) {
      const stats = await sharp(input, options).timeout({ seconds: L.decodeTimeoutSeconds }).stats();
      if (!stats.isOpaque) throw new PalmImageError('invalid'); // 배경 합성으로 선 대비를 바꾸지 않는다
    }
    let pipeline = sharp(input, options)
      .timeout({ seconds: L.decodeTimeoutSeconds })
      .autoOrient();                          // EXIF orientation 적용 (metadata는 출력에서 제거됨)
    if (meta.hasAlpha) pipeline = pipeline.removeAlpha();
    if (Math.max(oriented.width, oriented.height) > L.maxPreparedLongSide) {
      pipeline = pipeline.resize({
        width: L.maxPreparedLongSide, height: L.maxPreparedLongSide, fit: 'inside', withoutEnlargement: true,
      });
    }
    const { data, info } = await pipeline
      .toColourspace('srgb')
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true });
    if (data.byteLength > L.maxPreparedBytes) throw new PalmImageError('too-large');
    return { bytes: new Uint8Array(data), mimeType: 'image/jpeg', width: info.width, height: info.height };
  } catch (e) {
    if (e instanceof PalmImageError) throw e;
    throw new PalmImageError('invalid'); // 손상·decode 경고·timeout
  }
}
