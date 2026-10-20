-- ============================================================
-- Palm Phase 1C — read-only verification of supabase/palm-public.sql (db200a9)
-- SELECT only: changes nothing. Run in the Supabase SQL Editor of the destiny-code project.
-- Expected fingerprints come from applying palm-public.sql to a clean Postgres (PGlite).
-- Every row must show ok = true. Row counts are informational.
-- ============================================================
WITH
exp_fn(name, args, src_md5) AS (VALUES
  ('palm_cleanup',       '',                                                                                                                                                  'dc7f6a8f9a6c8bfe5155694ee6f08b2f'),
  ('palm_finalize',      'p_session_key text, p_request_id uuid, p_status text, p_error_code text',                                                                           '253b6f3f99f3e2212b57d8439ccdc2c9'),
  ('palm_issue_session', 'p_ip_key text, p_limit_per_hour integer',                                                                                                           '015797410427e714cf3421437b69dfc2'),
  ('palm_mark_started',  'p_session_key text, p_request_id uuid',                                                                                                             '19d1d064304ae93fbeea1711fc52859f'),
  ('palm_record_event',  'p_session_key text, p_event_id uuid, p_event text, p_supplement_version integer, p_duration_bucket text, p_error_code text, p_daily_limit integer', '075f5552a88d9082c25f0aeab37efc5d'),
  ('palm_reserve',       'p_kind text, p_session_key text, p_request_id uuid, p_payload_fp text, p_ip_key text, p_limits jsonb',                                              'a538c7b193be0de221bddaed90596f4e')),
exp_tbl(name, cols_md5, ncols) AS (VALUES
  ('palm_event_quota',      '8da9e6ba8f519817543bbabd624b8872', 3),
  ('palm_events',           'a67c792a8709d53bd3d60b2c06a83b6a', 6),
  ('palm_request_ledger',   'e18468482eabbcac6e9386231e48b4c7', 10),
  ('palm_session_issuance', '552efa2a2ff85298cd50833d3f39e620', 2)),
fn AS (
  SELECT p.oid, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, md5(p.prosrc) AS src_md5,
         p.prosecdef, p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'palm\_%'),
tbl AS (
  SELECT table_name AS name,
         md5(string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, ''), ',' ORDER BY ordinal_position)) AS cols_md5,
         count(*) AS ncols
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE 'palm\_%' GROUP BY table_name),
checks(item, ok, detail) AS (
  -- functions: exactly the six expected, same signature and body, SECURITY INVOKER, pinned search_path
  SELECT 'function ' || e.name, f.src_md5 = e.src_md5 AND NOT f.prosecdef AND f.proconfig = '{"search_path=pg_catalog, public"}',
         coalesce('body ' || CASE WHEN f.src_md5 = e.src_md5 THEN 'match' ELSE 'DIFFERS' END, 'MISSING')
    FROM exp_fn e LEFT JOIN fn f ON f.name = e.name AND f.args = e.args
  UNION ALL SELECT 'no extra palm_* functions', (SELECT count(*) FROM fn) = 6, (SELECT count(*) FROM fn)::text || ' found'
  -- tables: same columns/types/defaults, RLS on, no policies
  UNION ALL SELECT 'table ' || e.name, t.cols_md5 = e.cols_md5 AND t.ncols = e.ncols,
         coalesce('columns ' || CASE WHEN t.cols_md5 = e.cols_md5 THEN 'match' ELSE 'DIFFER' END, 'MISSING')
    FROM exp_tbl e LEFT JOIN tbl t ON t.name = e.name
  UNION ALL SELECT 'no extra palm_* tables', (SELECT count(*) FROM tbl) = 4, (SELECT count(*) FROM tbl)::text || ' found'
  UNION ALL SELECT 'RLS enabled ' || c.relname, c.relrowsecurity, c.relrowsecurity::text
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'palm\_%'
  UNION ALL SELECT 'no policies on palm_* tables', count(*) = 0, count(*)::text || ' policies'
    FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'palm\_%'
  -- privileges: anon/authenticated/PUBLIC nothing; service_role table DML + EXECUTE
  UNION ALL SELECT 'anon/authenticated: no table privilege', count(*) = 0, count(*)::text || ' grants'
    FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name LIKE 'palm\_%' AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  UNION ALL SELECT 'anon/authenticated/PUBLIC: no EXECUTE', bool_and(NOT has_function_privilege('anon', f.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', f.oid, 'EXECUTE')
                                                           AND NOT coalesce(f.oid IN (SELECT p.oid FROM pg_proc p, aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'), false)),
         'checked ' || count(*)::text FROM fn f
  UNION ALL SELECT 'service_role: EXECUTE on all six', bool_and(has_function_privilege('service_role', f.oid, 'EXECUTE')), 'checked ' || count(*)::text FROM fn f
  UNION ALL SELECT 'service_role: SELECT/INSERT/UPDATE/DELETE on palm tables',
         bool_and(has_table_privilege('service_role', 'public.' || t.name, 'SELECT,INSERT,UPDATE,DELETE')), 'checked ' || count(*)::text FROM tbl t
  -- existing service untouched
  UNION ALL SELECT 'analysis_results still present', to_regclass('public.analysis_results') IS NOT NULL, coalesce(to_regclass('public.analysis_results')::text, 'MISSING')
)
SELECT item, ok, detail FROM checks
UNION ALL SELECT 'info: rows palm_request_ledger',   NULL, (SELECT count(*) FROM palm_request_ledger)::text
UNION ALL SELECT 'info: rows palm_session_issuance', NULL, (SELECT count(*) FROM palm_session_issuance)::text
UNION ALL SELECT 'info: rows palm_event_quota',      NULL, (SELECT count(*) FROM palm_event_quota)::text
UNION ALL SELECT 'info: rows palm_events',           NULL, (SELECT count(*) FROM palm_events)::text
UNION ALL SELECT 'info: pg_cron installed',          NULL, coalesce((SELECT extversion FROM pg_extension WHERE extname = 'pg_cron'), 'not installed')
UNION ALL SELECT 'info: postgres version',           NULL, current_setting('server_version');
