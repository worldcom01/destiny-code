import type { AnalysisOutput, CoreTag, ElementKey } from './analysis';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion

function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function toCodeChar(n: number): string {
  return CODE_CHARS[n % CODE_CHARS.length];
}

export function generateDestinyCode(result: AnalysisOutput): string {
  const seed = [
    result.archetype,
    result.commonKeywords[0] ?? '',
    result.mbtiTraits.type,
    result.saju.dominantElement,
    result.bloodType.type,
  ].join('|');

  const h = djb2(seed);
  const l1 = toCodeChar(result.archetype.charCodeAt(0) || 0);
  const l2 = toCodeChar((h >> 8) & 0xff);
  const num = (h % 9000) + 1000;

  return `${l1}${l2}-${num}`;
}

export interface CompactProfile {
  c: string;          // code
  a: string;          // archetype
  t: CoreTag[];       // coreTags
  k: string[];        // commonKeywords (labels)
  m: string;          // mbti
  b: string;          // bloodType
  e: ElementKey;      // dominantElement
  z: string;          // zodiacSign (Korean)
  d: string;          // dayStem
  n?: string;         // nickname
}

export function encodeProfile(profile: CompactProfile): string {
  try {
    const json = JSON.stringify(profile);
    return btoa(encodeURIComponent(json));
  } catch {
    return '';
  }
}

export function decodeProfile(str: string): CompactProfile | null {
  try {
    const json = decodeURIComponent(atob(str));
    return JSON.parse(json) as CompactProfile;
  } catch {
    return null;
  }
}

export function isShareString(input: string): boolean {
  // Destiny codes are XX-NNNN (7 chars); anything longer is a share string
  return input.length > 10;
}
