#!/usr/bin/env bash
# docs/palm-phase1c-operations.md 의 블록을 그대로 쓰고 대상값만 채운다. 비밀값은 read -rs로만 입력받고 출력하지 않는다.
# 사용법: bash scripts/palm-ops/off-gate.sh  → OFF-CONFIRMED / OFF-NOT-CONFIRMED
TEAM='worldcom-s-projects'
PROJECT_ID='prj_iAZX0VG0ihAqmNwsmOLZ2lR9sn70'
ORIGIN='https://destiny-code.vercel.app'
# [palm-off-gate]  출력: OFF-CONFIRMED 또는 OFF-NOT-CONFIRMED
(
  { set +x +v; } 2>/dev/null
  set -u -o pipefail
  umask 077
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || { echo OFF-NOT-CONFIRMED; exit 1; }
  trap 'rm -rf "$WORK"' EXIT
  trap 'exit 130' INT TERM
  S=$(curl -sS --max-time 15 -o "$WORK/s.body" -D "$WORK/s.head" -w '%{http_code}' -X POST -H "Origin: $ORIGIN" "$ORIGIN/api/palm/session" 2>/dev/null) || S=000
  A=$(curl -sS --max-time 15 -o "$WORK/a.body" -w '%{http_code}' -X POST -H "Origin: $ORIGIN" -H 'content-type: image/jpeg' "$ORIGIN/api/palm/analyze" 2>/dev/null) || A=000
  E=$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' -X POST -H "Origin: $ORIGIN" -H 'content-type: application/json' -d '{}' "$ORIGIN/api/palm/events" 2>/dev/null) || E=000
  python3 - "$S" "$A" "$E" "$WORK" <<'PY'
import json, os, sys
s, a, e, work = sys.argv[1:5]
def load(name):
    try:
        with open(os.path.join(work, name), errors="replace") as f:
            return f.read()
    except OSError:
        return None
def as_json(text):
    try:
        return json.loads(text) if text is not None else None
    except Exception:
        return None
head = load("s.head")
sb, ab = as_json(load("s.body")), as_json(load("a.body"))
session_off = s == "200" and isinstance(sb, dict) and sb == {"enabled": False}
no_set_cookie = head is not None and not any(l.split(":", 1)[0].strip().lower() == "set-cookie" for l in head.splitlines() if ":" in l)
analyze_off = a == "503" and isinstance(ab, dict) and (ab.get("error") or {}).get("code") == "UNAVAILABLE"
events_off = e == "204"
print(f"session_off={session_off} no_set_cookie={no_set_cookie} analyze_503_unavailable={analyze_off} events_204={events_off}")
print("OFF-CONFIRMED" if (session_off and no_set_cookie and analyze_off and events_off) else "OFF-NOT-CONFIRMED")
PY
)
