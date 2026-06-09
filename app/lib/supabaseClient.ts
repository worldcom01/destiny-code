import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

// 클라이언트 사이드 전용 (anon key) — INSERT only. Lazy init so build doesn't fail without env vars.
export function getSupabaseClient(): SupabaseClient | null {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anon) return null;
  if (!_client) _client = createClient(url, anon);
  return _client;
}

// 테이블 행 타입
export interface AnalysisRow {
  id?: string;
  created_at?: string;
  destiny_code: string;
  archetype: string;
  intersection_keywords: string[];
  mbti: string;
  blood_type: string;
  zodiac: string;
  summary_sentence: string;
  sun_sign?: string | null;
  moon_sign?: string | null;
  ascendant_sign?: string | null;
  dominant_element?: string | null;
  data_level?: string | null;
}
