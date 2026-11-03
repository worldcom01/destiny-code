#!/usr/bin/env bash
# docs/palm-phase1c-operations.md 의 블록을 그대로 쓰고 대상값만 채운다. 비밀값은 read -rs로만 입력받고 출력하지 않는다.
# 사용법: bash scripts/palm-ops/session-check.sh  → SESSION-PASS / SESSION-FAIL (공개 ON 확인, OpenAI 호출 없음)
TEAM='worldcom-s-projects'
PROJECT_ID='prj_iAZX0VG0ihAqmNwsmOLZ2lR9sn70'
ORIGIN='https://destiny-code.vercel.app'
# [palm-on-session]  출력: SESSION-PASS 또는 SESSION-FAIL (cookie·CSRF 값은 출력하지 않음)
(
  { set +x +v; } 2>/dev/null
  set -u -o pipefail
  umask 077
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || { echo SESSION-FAIL; exit 1; }
  trap 'rm -rf "$WORK"' EXIT
  trap 'exit 130' INT TERM
  CODE=$(curl -sS --max-time 15 -o "$WORK/body" -D "$WORK/head" -w '%{http_code}' -X POST -H "Origin: $ORIGIN" "$ORIGIN/api/palm/session" 2>/dev/null) || CODE=000
  python3 - "$CODE" "$WORK" <<'PY'
import json, os, re, sys
code, work = sys.argv[1:3]
def load(name):
    try:
        with open(os.path.join(work, name), "rb") as f:
            return f.read().decode("utf-8", "strict")
    except (OSError, UnicodeDecodeError):
        return None

# 응답 JSON — 실제 계약: {"enabled": true, "csrfToken": <43자 base64url>, "noticeVersion": "palm-processing-1"}
try:
    body = json.loads(load("body") or "")
except Exception:
    body = None
json_ok = isinstance(body, dict) and set(body) == {"enabled", "csrfToken", "noticeVersion"} \
    and body["enabled"] is True and body["noticeVersion"] == "palm-processing-1"
csrf_ok = isinstance(body, dict) and isinstance(body.get("csrfToken"), str) \
    and re.fullmatch(r"[A-Za-z0-9_-]{43}", body["csrfToken"]) is not None

# Set-Cookie — 부분 문자열 검사 없이 이름·값·속성을 하나씩 정확히 파싱한다
def parse_headers(raw):
    if raw is None:
        return None
    lines = raw.replace("\r\n", "\n").split("\n")
    if sum(1 for l in lines if l.startswith("HTTP/")) != 1 or not lines[0].startswith("HTTP/"):
        return None                      # 응답 블록이 하나가 아니면(리다이렉트·1xx 포함) 판정하지 않는다
    out = []
    for l in lines[1:]:
        if l == "":
            continue
        if l[0] in " \t" or ":" not in l:
            return None                  # obs-fold·이름 없는 줄 = 형식 오류
        name, value = l.split(":", 1)
        if name != name.strip() or name == "":
            return None
        out.append((name.lower(), value.strip(" \t")))
    return out

def cookie_ok(v):
    parts = v.split(";")
    nv = parts[0]
    if nv.count("=") < 1 or nv != nv.strip():
        return False
    name, val = nv.split("=", 1)
    if name != "__Host-palm_session":
        return False                     # 대소문자·유사 이름 불허
    if re.fullmatch(r"[A-Za-z0-9_-]{43}\.[0-9]{1,12}\.[A-Za-z0-9_-]{43}", val) is None:
        return False                     # 빈 값·형식이 다른 값 불허
    seen = {}
    for seg in parts[1:]:
        seg = seg.strip(" \t")
        if seg == "":
            return False                 # 빈 속성(;;) = 형식 오류
        k, eq, a = seg.partition("=")
        k = k.strip(" \t").lower()
        if k in seen:
            return False                 # 중복 속성
        seen[k] = (eq == "=", a.strip(" \t"))
    if set(seen) != {"path", "max-age", "httponly", "secure", "samesite"}:
        return False                     # Domain·Expires·Foo 등 그 밖의 속성, 필수 속성 누락 모두 실패
    if seen["httponly"] != (False, "") or seen["secure"] != (False, ""):
        return False                     # 값 없는 플래그여야 한다 (Secure=1 불허)
    if seen["path"] != (True, "/") or seen["samesite"] != (True, "Lax"):
        return False
    has_eq, age = seen["max-age"]
    return has_eq and re.fullmatch(r"[1-9][0-9]{0,4}", age) is not None and int(age) <= 86400

headers = parse_headers(load("head"))
headers_ok = headers is not None
set_cookies = [v for n, v in (headers or []) if n == "set-cookie"]
cookie_valid = headers_ok and len(set_cookies) == 1 and cookie_ok(set_cookies[0])
print(f"http_200={code == '200'} json_contract={json_ok} csrf_format={csrf_ok} headers_well_formed={headers_ok} "
      f"set_cookie_count_1={len(set_cookies) == 1} session_cookie_strict={cookie_valid}")
print("SESSION-PASS" if (code == "200" and json_ok and csrf_ok and cookie_valid) else "SESSION-FAIL")
PY
)
