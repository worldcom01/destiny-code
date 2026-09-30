-- ============================================================
-- Destiny Code — Palm Phase 1C public cost control + minimal events
-- (docs/ai/CODEX_REVIEW.md "Palm Phase 1C" §6, §9; DECISIONS AD-009)
--
-- Server-only: called with the service role from Next.js route handlers.
-- anon/authenticated have NO table access and NO function EXECUTE.
-- Stores no image, no observation, no provider response, no raw IP, no raw session id:
--   session_key / ip_key / payload_fp are server HMACs (ip_key rotates daily).
-- The existing analysis_results table and its policies are NOT changed.
-- Rows expire after 24 h (events after 30 days): expired rows are ignored by the RPCs
-- and deleted by palm_cleanup() (and opportunistically inside palm_reserve).
-- ============================================================

CREATE TABLE IF NOT EXISTS palm_request_ledger (
  session_key      text        NOT NULL,
  request_id       uuid        NOT NULL,
  kind             text        NOT NULL CHECK (kind IN ('public', 'operator')),
  payload_fp       text        NOT NULL,
  ip_key           text        NOT NULL,
  status           text        NOT NULL CHECK (status IN ('reserved', 'provider-started', 'completed', 'failed', 'uncertain')),
  error_code       text        CHECK (error_code IS NULL OR error_code ~ '^[A-Z_]{1,40}$'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz NOT NULL,
  PRIMARY KEY (session_key, request_id)
);
CREATE INDEX IF NOT EXISTS idx_palm_ledger_created ON palm_request_ledger (created_at);
CREATE INDEX IF NOT EXISTS idx_palm_ledger_fp ON palm_request_ledger (session_key, payload_fp);
CREATE INDEX IF NOT EXISTS idx_palm_ledger_ip ON palm_request_ledger (ip_key, created_at);

CREATE TABLE IF NOT EXISTS palm_session_issuance (
  ip_key     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_palm_issuance ON palm_session_issuance (ip_key, created_at);

-- per-session event rate (kept apart from the analytics table; session keys are never copied there)
CREATE TABLE IF NOT EXISTS palm_event_quota (
  session_key text NOT NULL,
  utc_day     date NOT NULL,
  count       int  NOT NULL DEFAULT 0,
  PRIMARY KEY (session_key, utc_day)
);

-- minimal analytics: event enum + server time + versions/buckets only
CREATE TABLE IF NOT EXISTS palm_events (
  id                 uuid        PRIMARY KEY,
  event              text        NOT NULL CHECK (event IN ('palm_prompt_viewed', 'palm_started', 'palm_success', 'palm_unusable', 'palm_error', 'palm_retry')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  supplement_version int         CHECK (supplement_version IS NULL OR supplement_version BETWEEN 1 AND 99),
  duration_bucket    text        CHECK (duration_bucket IS NULL OR duration_bucket IN ('lt5s', '5to15s', '15to30s', 'gt30s')),
  error_code         text        CHECK (error_code IS NULL OR error_code ~ '^[A-Z_]{1,40}$')
);
CREATE INDEX IF NOT EXISTS idx_palm_events_created ON palm_events (created_at);

ALTER TABLE palm_request_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE palm_session_issuance ENABLE ROW LEVEL SECURITY;
ALTER TABLE palm_event_quota      ENABLE ROW LEVEL SECURITY;
ALTER TABLE palm_events           ENABLE ROW LEVEL SECURITY;
-- no policies: anon/authenticated get nothing even if a grant slips in
REVOKE ALL ON palm_request_ledger, palm_session_issuance, palm_event_quota, palm_events FROM PUBLIC, anon, authenticated;

-- ── atomic reservation right before the provider call ───────────────────────
-- One transaction-scoped advisory lock serialises all reservations across server instances.
-- Outcomes: reserved | duplicate-request | request-conflict | duplicate-image | rate-limited
CREATE OR REPLACE FUNCTION palm_reserve(
  p_kind text, p_session_key text, p_request_id uuid, p_payload_fp text, p_ip_key text, p_limits jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now      timestamptz := now();
  v_day      timestamptz := date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
  v_next_day int := ceil(extract(epoch FROM (v_day + interval '1 day' - now())))::int;
  r          palm_request_ledger%ROWTYPE;
  v_count    int;
  v_last     timestamptz;
  v_interval int := coalesce((p_limits->>'sessionIntervalSeconds')::int, 30);
BEGIN
  IF p_kind NOT IN ('public', 'operator') OR length(p_session_key) < 16 OR length(p_payload_fp) < 16 OR length(p_ip_key) < 8 THEN
    RAISE EXCEPTION 'palm_reserve: invalid arguments';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('palm_public_gate'));

  DELETE FROM palm_request_ledger WHERE created_at < v_now - interval '24 hours';
  -- a lost/crashed request whose lease ran out may have been billed: uncertain, never refunded
  UPDATE palm_request_ledger SET status = 'uncertain', error_code = 'LEASE_EXPIRED', updated_at = v_now
   WHERE status IN ('reserved', 'provider-started') AND lease_expires_at < v_now;

  SELECT * INTO r FROM palm_request_ledger WHERE session_key = p_session_key AND request_id = p_request_id;
  IF FOUND THEN
    IF r.payload_fp <> p_payload_fp THEN
      RETURN jsonb_build_object('outcome', 'request-conflict');
    END IF;
    RETURN jsonb_build_object('outcome', 'duplicate-request', 'status', r.status);
  END IF;

  IF p_kind = 'public' THEN
    -- same image, same session: in progress, or completed within 10 minutes → no new provider call
    IF EXISTS (SELECT 1 FROM palm_request_ledger WHERE session_key = p_session_key AND payload_fp = p_payload_fp
                 AND (status IN ('reserved', 'provider-started')
                      OR (status = 'completed' AND created_at > v_now - interval '10 minutes'))) THEN
      RETURN jsonb_build_object('outcome', 'duplicate-image', 'retry_after', 600);
    END IF;
    -- after a failed/uncertain attempt the same image may be retried once
    SELECT count(*) INTO v_count FROM palm_request_ledger
     WHERE session_key = p_session_key AND payload_fp = p_payload_fp AND status IN ('failed', 'uncertain')
       AND created_at > v_now - interval '10 minutes';
    IF v_count >= 2 THEN
      RETURN jsonb_build_object('outcome', 'duplicate-image', 'retry_after', 600);
    END IF;

    SELECT count(*) INTO v_count FROM palm_request_ledger
     WHERE session_key = p_session_key AND status IN ('reserved', 'provider-started');
    IF v_count >= coalesce((p_limits->>'sessionConcurrent')::int, 1) THEN
      RETURN jsonb_build_object('outcome', 'rate-limited', 'scope', 'session-concurrent', 'retry_after', 30);
    END IF;
    SELECT max(created_at) INTO v_last FROM palm_request_ledger WHERE session_key = p_session_key;
    IF v_last IS NOT NULL AND v_last > v_now - make_interval(secs => v_interval) THEN
      RETURN jsonb_build_object('outcome', 'rate-limited', 'scope', 'session-interval',
        'retry_after', greatest(1, ceil(extract(epoch FROM (v_last + make_interval(secs => v_interval) - v_now)))::int));
    END IF;
    SELECT count(*) INTO v_count FROM palm_request_ledger WHERE session_key = p_session_key AND created_at >= v_day;
    IF v_count >= coalesce((p_limits->>'sessionDaily')::int, 3) THEN
      RETURN jsonb_build_object('outcome', 'rate-limited', 'scope', 'session-daily', 'retry_after', v_next_day);
    END IF;
    SELECT count(*) INTO v_count FROM palm_request_ledger WHERE ip_key = p_ip_key AND created_at >= v_day;
    IF v_count >= coalesce((p_limits->>'ipDaily')::int, 10) THEN
      RETURN jsonb_build_object('outcome', 'rate-limited', 'scope', 'ip-daily', 'retry_after', v_next_day);
    END IF;
  END IF;

  -- global caps include the operator path so it cannot bypass the public budget
  SELECT count(*) INTO v_count FROM palm_request_ledger WHERE status IN ('reserved', 'provider-started');
  IF v_count >= coalesce((p_limits->>'globalConcurrent')::int, 2) THEN
    RETURN jsonb_build_object('outcome', 'rate-limited', 'scope', 'global-concurrent', 'retry_after', 30);
  END IF;
  SELECT count(*) INTO v_count FROM palm_request_ledger WHERE created_at >= v_day;
  IF v_count >= coalesce((p_limits->>'globalDaily')::int, 100) THEN
    RETURN jsonb_build_object('outcome', 'rate-limited', 'scope', 'global-daily', 'retry_after', v_next_day);
  END IF;

  INSERT INTO palm_request_ledger (session_key, request_id, kind, payload_fp, ip_key, status, lease_expires_at)
  VALUES (p_session_key, p_request_id, p_kind, p_payload_fp, p_ip_key, 'reserved', v_now + interval '120 seconds');
  RETURN jsonb_build_object('outcome', 'reserved');
END;
$$;

CREATE OR REPLACE FUNCTION palm_mark_started(p_session_key text, p_request_id uuid) RETURNS boolean
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE palm_request_ledger SET status = 'provider-started', updated_at = now()
   WHERE session_key = p_session_key AND request_id = p_request_id AND status = 'reserved' AND lease_expires_at >= now();
  RETURN FOUND;
END;
$$;

-- terminal states are never overwritten (a late finalize after lease expiry keeps 'uncertain')
CREATE OR REPLACE FUNCTION palm_finalize(p_session_key text, p_request_id uuid, p_status text, p_error_code text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_status NOT IN ('completed', 'failed', 'uncertain') THEN
    RAISE EXCEPTION 'palm_finalize: invalid status';
  END IF;
  UPDATE palm_request_ledger SET status = p_status, error_code = p_error_code, updated_at = now()
   WHERE session_key = p_session_key AND request_id = p_request_id AND status IN ('reserved', 'provider-started');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION palm_issue_session(p_ip_key text, p_limit_per_hour int) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count int;
  v_first timestamptz;
BEGIN
  IF length(p_ip_key) < 8 THEN
    RAISE EXCEPTION 'palm_issue_session: invalid arguments';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('palm_session_issuance'));
  DELETE FROM palm_session_issuance WHERE created_at < now() - interval '24 hours';
  SELECT count(*), min(created_at) INTO v_count, v_first FROM palm_session_issuance
   WHERE ip_key = p_ip_key AND created_at > now() - interval '1 hour';
  IF v_count >= p_limit_per_hour THEN
    RETURN jsonb_build_object('outcome', 'rate-limited',
      'retry_after', greatest(1, ceil(extract(epoch FROM (v_first + interval '1 hour' - now())))::int));
  END IF;
  INSERT INTO palm_session_issuance (ip_key) VALUES (p_ip_key);
  RETURN jsonb_build_object('outcome', 'issued');
END;
$$;

CREATE OR REPLACE FUNCTION palm_record_event(
  p_session_key text, p_event_id uuid, p_event text, p_supplement_version int, p_duration_bucket text,
  p_error_code text, p_daily_limit int
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_day   date := (now() AT TIME ZONE 'utc')::date;
  v_count int;
BEGIN
  INSERT INTO palm_event_quota (session_key, utc_day, count) VALUES (p_session_key, v_day, 1)
  ON CONFLICT (session_key, utc_day) DO UPDATE SET count = palm_event_quota.count + 1
  RETURNING count INTO v_count;
  IF v_count > p_daily_limit THEN
    RETURN jsonb_build_object('outcome', 'rate-limited');
  END IF;
  INSERT INTO palm_events (id, event, supplement_version, duration_bucket, error_code)
  VALUES (p_event_id, p_event, p_supplement_version, p_duration_bucket, p_error_code)
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('outcome', CASE WHEN FOUND THEN 'recorded' ELSE 'duplicate' END);
END;
$$;

-- schedule daily (e.g. Supabase cron): expired control rows and 30-day-old events are deleted
CREATE OR REPLACE FUNCTION palm_cleanup() RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  a int; b int; c int; d int;
BEGIN
  DELETE FROM palm_request_ledger   WHERE created_at < now() - interval '24 hours'; GET DIAGNOSTICS a = ROW_COUNT;
  DELETE FROM palm_session_issuance WHERE created_at < now() - interval '24 hours'; GET DIAGNOSTICS b = ROW_COUNT;
  DELETE FROM palm_event_quota      WHERE utc_day < (now() AT TIME ZONE 'utc')::date - 1; GET DIAGNOSTICS c = ROW_COUNT;
  DELETE FROM palm_events           WHERE created_at < now() - interval '30 days'; GET DIAGNOSTICS d = ROW_COUNT;
  RETURN jsonb_build_object('ledger', a, 'issuance', b, 'eventQuota', c, 'events', d);
END;
$$;

REVOKE ALL ON FUNCTION palm_reserve(text, text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION palm_mark_started(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION palm_finalize(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION palm_issue_session(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION palm_record_event(text, uuid, text, int, text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION palm_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION palm_reserve(text, text, uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION palm_mark_started(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION palm_finalize(text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION palm_issue_session(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION palm_record_event(text, uuid, text, int, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION palm_cleanup() TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON palm_request_ledger, palm_session_issuance, palm_event_quota, palm_events TO service_role;
