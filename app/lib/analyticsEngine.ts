import { supabase, type AnalysisRow } from './supabaseClient';
import type { AnalysisOutput } from './analysis';

const SESSION_KEY = 'destiny_saved_codes';

function getSavedCodes(): Set<string> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function markCodeSaved(code: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const saved = getSavedCodes();
  saved.add(code);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify([...saved]));
}

/**
 * 분석 결과를 Supabase에 익명으로 저장합니다.
 * - 개인정보(이름, 생년월일 원본) 저장 안 함
 * - 같은 세션에서 동일 코드는 중복 저장 안 함
 * - Supabase 미설정(env 누락) 시 조용히 건너뜀
 */
export async function saveAnalyticsResult(
  result: AnalysisOutput,
  destinyCode: string,
): Promise<void> {
  // env 미설정이면 skip
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  // 세션 내 중복 방지
  if (getSavedCodes().has(destinyCode)) return;

  const wa = result.westernAstrology;

  const row: AnalysisRow = {
    destiny_code:          destinyCode,
    archetype:             result.archetype,
    intersection_keywords: result.commonKeywords,
    mbti:                  result.mbtiTraits.type,
    blood_type:            result.bloodType.type,
    zodiac:                result.zodiac.sign,
    summary_sentence:      result.identityStatement,
    sun_sign:              wa.sun.data.sign,
    moon_sign:             wa.moon?.data.sign ?? null,
    ascendant_sign:        wa.ascendant?.data.sign ?? null,
    dominant_element:      result.saju.dominantElement,
    data_level:            wa.dataLevel,
  };

  const { error } = await supabase.from('analysis_results').insert(row);

  if (error) {
    console.warn('[analytics] save failed:', error.message);
    return;
  }

  markCodeSaved(destinyCode);
}
