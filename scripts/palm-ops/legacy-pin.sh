#!/usr/bin/env bash
# v2→v3 무중단 전환: 현재 설치된 v2 토큰을 발급한 커밋(3e1136f)을 Production Config로 고정한다.
# 비밀값 아님. destiny-code Production에만 추가. 사용법: bash scripts/palm-ops/legacy-pin.sh set | unset
(
  set -u
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || exit 1
  trap 'rm -rf "$WORK"' EXIT
  vc() { npx -y vercel@64.7.0 --non-interactive --no-color --scope worldcom-s-projects --cwd "$WORK" "$@"; }
  P=prj_iAZX0VG0ihAqmNwsmOLZ2lR9sn70
  case "${1:-}" in
    set)
      printf '%s' '3e1136faedb9e8adb44b56b297aed92d1b9a862a' | vc env add PALM_INGRESS_LEGACY_COMMIT --environment production \
        --project "$P" --type config --force --yes > "$WORK/o" 2>&1 && echo "LEGACY-PIN-SET" || echo "LEGACY-PIN-ERROR" ;;
    unset)
      vc env rm PALM_INGRESS_LEGACY_COMMIT --environment production --project "$P" --yes > "$WORK/o" 2>&1 && echo "LEGACY-PIN-REMOVED" || echo "LEGACY-PIN-REMOVE-ERROR" ;;
    *) echo "usage: palm-legacy-pin.sh set|unset" ;;
  esac
)
