#!/usr/bin/env bash
# docs/palm-phase1c-operations.md 의 블록을 그대로 쓰고 대상값만 채운다. 비밀값은 read -rs로만 입력받고 출력하지 않는다.
# 사용법: bash scripts/palm-ops/install-token.sh <dpl_ID> <commit 7자리>
TEAM='worldcom-s-projects'
PROJECT_ID='prj_iAZX0VG0ihAqmNwsmOLZ2lR9sn70'
ORIGIN='https://destiny-code.vercel.app'
DPL_ID="${1:?usage: install-token.sh <dpl_ID> <commit7>}"
EXPECTED_COMMIT="${2:?usage: install-token.sh <dpl_ID> <commit7>}"
# [palm-1b-install]  설치·재설정: probe 재발급 토큰 → stdin → Production Secret (화면·argv·history에 값 없음)
(
  { set +x +v; } 2>/dev/null
  set -u -o pipefail
  umask 077
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || { echo INSTALL-ERROR; exit 1; }
  cleanup() { rm -rf "$WORK"; unset OP_SECRET ISSUED RESP PARSED; }
  trap cleanup EXIT
  trap 'exit 130' INT TERM
  status() { echo "$1"; exit 0; }
  vc() { npx -y vercel@64.7.0 --non-interactive --no-color --scope "$TEAM" --cwd "$WORK" "$@"; }
  active_is_dpl() {
    vc inspect "${ORIGIN#https://}" > "$WORK/inspect.txt" 2>&1 || return 1
    python3 -c '
import re, sys
ids = re.findall(r"^\s*id\s+(dpl_[A-Za-z0-9]+)\s*$", open(sys.argv[1], errors="replace").read(), re.M)
sys.exit(0 if len(ids) == 1 and ids[0] == sys.argv[2] else 1)' "$WORK/inspect.txt" "$DPL_ID"
  }

  active_is_dpl || status STOP-DEPLOYMENT-UNVERIFIED
  IFS= read -rs -p 'operator secret (입력은 표시되지 않음): ' OP_SECRET; echo >&2
  OP_SECRET=${OP_SECRET//\\/\\\\}; OP_SECRET=${OP_SECRET//\"/\\\"}   # curl config 이스케이프: \ → \\, " → \"
  RESP=$(printf 'header = "x-palm-extraction-secret: %s"\nheader = "x-palm-ingress-probe: 192.0.2.77"\n' "$OP_SECRET" \
    | curl -sS --max-time 20 --config - -X POST "$ORIGIN/api/palm/ingress-check" 2>/dev/null) || status INSTALL-ERROR
  unset OP_SECRET
  PARSED=$(python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
except Exception:
    print("bad"); sys.exit(0)
est = d.get("ingress") == "established" and isinstance(d.get("verificationToken"), str) and d["verificationToken"] != ""
commit = (d.get("deployment") or {}).get("commit")
print("established" if est else "bad")
print("commit-ok" if isinstance(commit, str) and commit == sys.argv[1] else "commit-bad")
print(d.get("verificationToken", "") if est else "")' "$EXPECTED_COMMIT" <<<"$RESP")
  unset RESP
  [ "$(sed -n 1p <<<"$PARSED")" = established ] || { unset PARSED; status INSTALL-ERROR; }
  [ "$(sed -n 2p <<<"$PARSED")" = commit-ok ] || { unset PARSED; status STOP-COMMIT-UNVERIFIED; }
  ISSUED=$(sed -n 3p <<<"$PARSED"); unset PARSED
  active_is_dpl || status STOP-DEPLOYMENT-UNVERIFIED
  # --environment production 만 대상, 같은 환경의 기존 값은 --force로 교체 (값은 stdin)
  printf '%s' "$ISSUED" | vc env add PALM_TRUSTED_INGRESS_VERIFICATION --environment production \
    --project "$PROJECT_ID" --type secret --force --yes > /dev/null 2>&1 || status INSTALL-ERROR
  status INSTALLED-REDEPLOY-SAME-COMMIT-NEXT
)
