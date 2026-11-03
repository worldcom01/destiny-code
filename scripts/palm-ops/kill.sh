#!/usr/bin/env bash
# Palm 즉시 OFF 또는 직전 배포로 복귀: Production 도메인을 지정한 배포로 Instant Rollback (재빌드 없음).
# 사용법: bash scripts/palm-ops/kill.sh <dpl_ID>
(
  set -u
  TARGET="${1:?usage: kill.sh <dpl_ID>}"
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || exit 1
  trap 'rm -rf "$WORK"' EXIT
  npx -y vercel@64.7.0 --non-interactive --no-color --scope worldcom-s-projects --cwd "$WORK" rollback "$TARGET" --yes > "$WORK/o" 2>&1 \
    && echo ROLLBACK-SUBMITTED || { echo ROLLBACK-ERROR; tail -3 "$WORK/o"; }
)
