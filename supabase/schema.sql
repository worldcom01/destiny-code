-- ============================================================
-- Destiny Code Lab — Beta Analytics Schema
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS analysis_results (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           timestamptz DEFAULT now() NOT NULL,
  destiny_code         text        NOT NULL,
  archetype            text        NOT NULL,
  intersection_keywords text[]     NOT NULL DEFAULT '{}',
  mbti                 text        NOT NULL DEFAULT '',
  blood_type           text        NOT NULL DEFAULT '',
  zodiac               text        NOT NULL DEFAULT '',
  summary_sentence     text        NOT NULL DEFAULT '',
  -- 서양점성술 (optional — 기존 데이터 호환)
  sun_sign             text,
  moon_sign            text,
  ascendant_sign       text,
  -- 사주
  dominant_element     text,
  data_level           text        DEFAULT 'sun-only'  -- 'sun-only' | 'sun-moon' | 'full'
);

-- 2. Row Level Security 활성화
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- 3. 익명 INSERT 허용 (결과 저장)
CREATE POLICY "anon_insert" ON analysis_results
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 4. 인증된 사용자(service_role 포함) SELECT 허용
--    service_role은 RLS를 bypass하므로 별도 정책 불필요
--    일반 authenticated 유저에겐 SELECT 차단 (관리자 API route만 service_role 사용)

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis_results (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_destiny_code ON analysis_results (destiny_code);
CREATE INDEX IF NOT EXISTS idx_analysis_archetype ON analysis_results (archetype);

-- 6. 중복 저장 방지용 함수
--    같은 destiny_code가 1시간 이내에 이미 저장된 경우 무시
--    클라이언트 단에서도 sessionStorage로 한번 더 방지함
CREATE OR REPLACE FUNCTION prevent_duplicate_analysis()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM analysis_results
    WHERE destiny_code = NEW.destiny_code
      AND created_at > now() - INTERVAL '1 hour'
  ) THEN
    RETURN NULL;  -- 중복 → 조용히 무시
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_prevent_duplicate
  BEFORE INSERT ON analysis_results
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_analysis();
