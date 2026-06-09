import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// 클라이언트 사이드 전용 (anon key) — INSERT only
export const supabase = createClient(url, anon);

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
