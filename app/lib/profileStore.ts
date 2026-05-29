import type { CoreTag, ElementKey } from './analysis';
import { type CompactProfile, encodeProfile, decodeProfile } from './destinyCode';

export interface DestinyProfile {
  code: string;
  nickname?: string;
  archetype: string;
  identityStatement: string;
  commonKeywords: string[];
  coreTags: CoreTag[];
  mbti: string;
  bloodType: string;
  tarotName: string;
  dayStem: string;
  zodiacSign: string;
  zodiacSignEn: string;
  dominantElement: ElementKey;
  createdAt: string;
}

const STORE_KEY = 'destiny_profiles_v1';

// ── Supabase-ready interface (implement by replacing these functions) ──────

export function saveProfile(profile: DestinyProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const list = loadAllProfiles();
    const updated = [profile, ...list.filter(p => p.code !== profile.code)].slice(0, 30);
    localStorage.setItem(STORE_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export function getProfileByCode(code: string): DestinyProfile | null {
  return loadAllProfiles().find(p => p.code === code) ?? null;
}

export function loadAllProfiles(): DestinyProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as DestinyProfile[];
  } catch {
    return [];
  }
}

export function getMostRecentProfile(): DestinyProfile | null {
  const profiles = loadAllProfiles();
  return profiles[0] ?? null;
}

// ── Compact share encoding (cross-device sharing without backend) ──────────

export function profileToShareString(profile: DestinyProfile): string {
  const compact: CompactProfile = {
    c: profile.code,
    a: profile.archetype,
    t: profile.coreTags,
    k: profile.commonKeywords,
    m: profile.mbti,
    b: profile.bloodType,
    e: profile.dominantElement,
    z: profile.zodiacSign,
    d: profile.dayStem,
    n: profile.nickname,
  };
  return encodeProfile(compact);
}

export function shareStringToProfile(str: string): DestinyProfile | null {
  const compact = decodeProfile(str);
  if (!compact) return null;
  return {
    code: compact.c,
    nickname: compact.n,
    archetype: compact.a,
    identityStatement: '',
    commonKeywords: compact.k,
    coreTags: compact.t,
    mbti: compact.m,
    bloodType: compact.b,
    tarotName: '',
    dayStem: compact.d,
    zodiacSign: compact.z,
    zodiacSignEn: '',
    dominantElement: compact.e,
    createdAt: '',
  };
}
