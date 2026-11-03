#!/usr/bin/env bash
# 1-A trusted ingress probe — Production 도메인과 배포 URL에서 각 5회(대조·IPv4·IPv6·목록 위조). 공개 OFF/ON 무관, OpenAI·DB 호출 없음.
# 사용법: bash scripts/palm-ops/probe.sh <commit 7자리> <배포 URL 호스트>
# 출력: probe별 ingress/reason/commit/fingerprint/tokenIssued, 최종 1A-PASS / 1A-FAIL. 토큰·secret은 출력하지 않는다.
(
  { set +x +v; } 2>/dev/null
  set -u -o pipefail
  umask 077
  EXPECTED_COMMIT="${1:?usage: probe.sh <commit7> <deployment host>}"
  DEPLOY_HOST="${2:?usage: probe.sh <commit7> <deployment host>}"
  HOSTS="https://destiny-code.vercel.app https://${DEPLOY_HOST#https://}"
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || { echo 1A-FAIL; exit 1; }
  cleanup() { rm -rf "$WORK"; unset OP_SECRET ESC; }
  trap cleanup EXIT
  trap 'exit 130' INT TERM
  IFS= read -rs -p 'operator secret (입력은 표시되지 않음): ' OP_SECRET; echo >&2
  [ -n "$OP_SECRET" ] || { echo "1A-FAIL (빈 입력)"; exit 0; }
  echo "입력 길이: ${#OP_SECRET}자" >&2
  # curl config 따옴표 문자열 이스케이프: \ → \\, " → \" (값은 변수에만 둔다)
  ESC=${OP_SECRET//\\/\\\\}; ESC=${ESC//\"/\\\"}
  unset OP_SECRET
  probe() {  # $1 host, $2 label, 나머지 = 추가 curl 인자(위조 헤더)
    local host=$1 label=$2; shift 2
    printf 'header = "x-palm-extraction-secret: %s"\nheader = "x-palm-ingress-probe: 192.0.2.77"\n' "$ESC" \
      | curl -sS --max-time 20 --config - -o "$WORK/r.json" -w '%{http_code}' -X POST "$@" "$host/api/palm/ingress-check" 2>/dev/null > "$WORK/code" || echo 000 > "$WORK/code"
    python3 - "$host" "$label" "$(cat "$WORK/code")" "$WORK/r.json" >> "$WORK/results.jsonl" <<'PY'
import json, sys
host, label, code, path = sys.argv[1:5]
try:
    d = json.load(open(path))
except Exception:
    d = {}
out = {"host": host.split("//")[1].split(".")[0], "probe": label, "http": code}
for k in ("ingress", "reason", "strategy", "ipFingerprint", "error"):
    if k in d: out[k] = d[k]
if isinstance(d.get("deployment"), dict): out["commit"] = d["deployment"].get("commit"); out["env"] = d["deployment"].get("environment")
out["tokenIssued"] = isinstance(d.get("verificationToken"), str) and d["verificationToken"] != ""
print(json.dumps(out))
PY
    : > "$WORK/r.json"
  }
  for H in $HOSTS; do
    probe "$H" a-control
    probe "$H" b-v4-doc  -H "x-vercel-forwarded-for: 192.0.2.77" -H "x-forwarded-for: 192.0.2.77" -H "x-real-ip: 192.0.2.77"
    probe "$H" b-v4-real -H "x-vercel-forwarded-for: 8.8.8.8" -H "x-forwarded-for: 8.8.8.8"
    probe "$H" c-v6      -H "x-vercel-forwarded-for: 2606:4700:4700::1111"
    probe "$H" c-list    -H "x-vercel-forwarded-for: 8.8.4.4, 1.1.1.1" -H "x-forwarded-for: 8.8.4.4, 1.1.1.1"
  done
  unset ESC
  python3 - "$EXPECTED_COMMIT" "$WORK/results.jsonl" <<'PY'
import json, sys
exp, path = sys.argv[1:3]
rows = [json.loads(l) for l in open(path)]
for r in rows:
    print(json.dumps(r, ensure_ascii=False))
established = all(r.get("ingress") == "established" and r.get("http") == "200" for r in rows)
commit_ok = all(r.get("commit") == exp and r.get("env") == "production" for r in rows)
fps = {r.get("ipFingerprint") for r in rows}
same_fp = len(fps) == 1 and None not in fps
tokens = all(r.get("tokenIssued") for r in rows)
print(f"probes={len(rows)} all_established={established} commit_{exp}={commit_ok} single_fingerprint={same_fp} token_issued_all={tokens}")
print("1A-PASS" if (len(rows) == 10 and established and commit_ok and same_fp and tokens) else "1A-FAIL")
PY
)
