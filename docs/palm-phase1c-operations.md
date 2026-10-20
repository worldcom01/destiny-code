# Palm Phase 1C — 운영 절차 (공개 손바닥 패턴 분석)

기본값은 **꺼짐**(`PALM_PUBLIC_ENABLED=false`)이다.

**공개 ON은 8단계 안에서만 한다.** 그 전에 1~7단계를 모두 통과해야 한다(migration, N-1 실제 PostgreSQL 다중 연결 smoke, 실기기 mock 포함). 그리고 별도 운영 승인이 필요하다.

8단계 내부 순서: 승인된 ON 설정 전환과 같은 커밋 재배포 → 1-C session 확인(SESSION-PASS) → 별도 승인된 live OpenAI 1회 → 공개 유지 여부를 별도로 결정. 하나라도 실패하면 1-D로 즉시 OFF 복귀한다.
설계: `docs/ai/CODEX_REVIEW.md` "Palm Phase 1C", `docs/ai/DECISIONS.md` AD-007~009.

> **신뢰 ingress 검증은 릴리스·보안 설정에 결합된다. 새 커밋, 환경·프로젝트·origin·세션 키·전략 변경 또는 ingress 세대 변경 시 재검증한다. 같은 설정의 같은 커밋에서 토큰을 적용하는 env-only 재배포는 기존 토큰을 유지한다.**
> 코드 변경 없이 proxy 토폴로지·도메인·ingress 동작 등 신뢰 IP에 영향을 주는 인프라를 바꿀 때도 먼저 공개 OFF로 전환하고 `PALM_INGRESS_GENERATION`을 변경한 뒤 재검증한다. 배포 ID 변경만으로 토큰이 자동 무효화되지는 않는다.

## 1. 통제된 준비 순서 (그대로 실행 가능한 체크리스트)

**공개 사용자 접근(`PALM_PUBLIC_ENABLED`)과 운영자 ingress 검증은 별개다.**
- ingress probe(`/api/palm/ingress-check`)는 `PALM_PUBLIC_ENABLED=false`, `PALM_EXTRACTION_ENABLED=false` 상태에서 동작한다. OpenAI·DB를 호출하지 않는다.
- probe는 공개 기능을 켜지 않는다.
- 아래 1~7단계 동안 `PALM_PUBLIC_ENABLED`는 **계속 `false`**다. 8단계 이전에는 켜지 않는다.

1. **공개 OFF로 시작**: `PALM_PUBLIC_ENABLED=false`로 둔다. 이미 켜져 있으면 먼저 끄고 배포한다.
2. **서버 인프라 배포 (공개 OFF)**: 아래 **1-0 환경변수와 Vercel scope** 표대로 설정하고, 대상 환경(아래 1-0 참고)을 배포한다.
   - 이 단계에서 `PALM_PUBLIC_ENABLED=false`를 유지하고, `PALM_TRUSTED_INGRESS_VERIFICATION`은 비워 둔다.
   - Vercel 프로젝트 설정에서 **Enable access to System Environment Variables**를 켠다(필수). 이것이 꺼져 있으면 `VERCEL_*` 값이 없어 fail closed된다.
   - **git 연동 배포**여야 한다. CLI 등 커밋 SHA가 없는 배포는 지원하지 않으며 fail closed된다.
   - Vercel env 변경은 **다음 배포부터** 적용된다. 값을 바꿨다면 반드시 재배포한다.
   - 로그/APM: 요청 body와 헤더 capture를 끈다. cookie, `x-palm-csrf`, IP, 이미지가 로그에 남지 않게 한다.

3. **DB (별도 승인 후)**: 공개 OFF 상태에서 진행한다.
   - Supabase SQL Editor에서 `supabase/palm-public.sql`을 transaction으로 적용한다. 기존 `analysis_results`와 그 정책은 바꾸지 않는다.
   - anon/authenticated의 테이블 접근과 RPC 실행이 거부되는지 확인하고, service role 동작을 확인한다.
   - `select palm_cleanup();`을 예약한다(예: pg_cron 5분 주기). 실제 삭제 시점은 예약 주기만큼 늦어질 수 있다.
4. **ingress probe (공개 OFF, 비유료)**: 아래 1-A 절차를 모두 수행한다.
   - 대조 요청, 여러 형태의 위조값, 두 네트워크 비교, 배포 URL 비교를 모두 포함한다.
   - 모든 확인은 **같은 배포**, **같은 UTC 날짜**에 한다.
5. **배포 결합 검증값 설치와 확인 (여전히 공개 OFF)**: 아래 **1-B** 절차를 따른다.
   - 1-B의 `palm-1b-install`로 실행 중 배포의 probe 재발급 토큰을 Production scope의 `PALM_TRUSTED_INGRESS_VERIFICATION`(Secret)에 설치한다. 값은 화면·인자·history를 거치지 않는다.
   - 그다음 **같은 커밋을** 재배포한다(`PALM_PUBLIC_ENABLED=false` 유지).
   - 같은 커밋의 env-only 재배포는 배포 식별값이 같으므로 토큰이 유효하다.
   - **probe가 `established`인 것만으로는 설치 확인이 아니다.** probe는 `PALM_TRUSTED_INGRESS_VERIFICATION`을 읽지 않는다. 그래서 빈 값·오타·다른 환경 토큰을 설치해도 probe는 계속 성공한다. 1-B로 설치값을 따로 확인한다.
   - 새 커밋을 배포했다면 4단계부터 다시 한다.
6. **DB-only 다중 연결 동시성 smoke (N-1, live 전 필수)**:
   - 별도 연결로 다음을 검사한다: 같은 요청 ID 동시 reserve, 세션·전체 한도 직전 경합, lease 만료 복구, finalize 경합.
   - reserve 성공 수가 한도를 넘지 않고, 소비 예산이 환불되지 않는지 확인한다.
   - OpenAI provider는 연결하지 않는다.
7. **실기기 MOCK 경로**: 격리된 preview나 로컬 mock harness에서 검사한다. production의 공개 경로를 mock처럼 켜지 않는다.
   - iPhone 카메라·갤러리, HEIC 안내, 큰 사진
   - Android JPEG/WebP
   - 취소·실패·재시도, 저장 후 다시 열기, A/B 결과 격리, 삭제 중 늦은 응답, 공유, 429·비활성 안내
8. **공개 ON (별도 운영 승인 후에만)**: 1~7단계 증거를 확인하고 별도 승인을 받은 뒤 아래 1-C를 따른다.
   - 사전 조건: migration 적용, N-1 PASS, 실기기 mock PASS, 1-B 결과(MATCH 또는 INSTALLED-FROM-PROBE).
   - 순서: ON 설정 전환과 같은 커밋 재배포 → session 확인 → 별도 승인 live 1회 → 공개 유지 결정.
   - 어떤 실패가 나오면 1-D로 즉시 OFF 복귀하고, OpenAI 호출은 하지 않는다.

## 1-0. 환경변수와 Vercel scope (코드가 실제로 읽는 값만)

Vercel 환경변수는 **Production / Preview / Development** scope별로 따로 설정한다.
- Preview에는 branch별 override를 둘 수 있으며, override가 일반 Preview 값보다 우선한다.
- 값 변경은 해당 scope의 **다음 배포**부터 적용된다.

**Phase 1C 공개 경로 대상은 Production 하나다.**
- 토큰은 `VERCEL_ENV`에 묶인다. Preview에서 발급한 토큰은 Production에서 거부되고, 그 반대도 마찬가지다.
- 따라서 Production 토큰은 반드시 Production 배포에서 probe로 발급하고, Production scope에 설치한다.
- Development(`vercel dev`, `VERCEL_ENV=development`)는 지원하지 않으며 fail closed된다.

| 변수 | 비밀 여부 | Production | Preview | 코드 위치 |
|---|---|---|---|---|
| `PALM_PUBLIC_ENABLED` | 아님 | `false` (8단계 별도 결정 전까지) | `false` 또는 미설정 | palmPublicAccess |
| `PALM_EXTRACTION_ENABLED` | 아님 | 준비 중 `false` (probe와 무관) | `false` 또는 미설정 | palmAccess / palmPublicAccess |
| `PALM_EXTRACTION_SECRET` | **secret** | probe·operator용 | 미설정 권장. 필요하면 Production과 **다른** 값 | palmAccess / palmIngressProbe |
| `PALM_SESSION_SECRET` | **secret** | 32자 이상, 운영자 secret과 다른 값 | 미설정 권장. 필요하면 Production과 **다른** 값 | palmPublicAccess |
| `PALM_PUBLIC_ORIGIN` | 아님 | 정확한 Production https origin | 미설정 | palmPublicAccess |
| `PALM_TRUSTED_INGRESS` | 아님 | `vercel` | 미설정 | palmPublicAccess |
| `PALM_INGRESS_GENERATION` | 아님 | 예 `g1` (ingress 구성 변경 시 올림) | 미설정 | palmPublicAccess |
| `PALM_TRUSTED_INGRESS_VERIFICATION` | **secret 취급** | 2단계에서는 빈 값. 5단계에서 Production probe 토큰 설치 | 미설정 | palmPublicAccess |
| `PALM_LIMIT_*` (8개, 선택) | 아님 | 미설정이면 기본 상한 | 미설정 | palmPublicAccess |
| `OPENAI_API_KEY` | **secret** | 준비만 한다(8단계 전 provider 사용 없음) | **미설정** | palmAccess / palmPublicAccess |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | migration 승인 후 설정 | **미설정**, 또는 production이 아닌 별도 DB의 key | palmPublicAccess(서버 전용 RPC) |
| `NEXT_PUBLIC_SUPABASE_URL` | 아님 (**예외**, 아래 참고) | 운영 Supabase 프로젝트 URL | 기존 앱 설정 그대로 | palmPublicAccess(서버), supabaseClient(브라우저, 기존 analytics) |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_PROJECT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID` | 아님 | Vercel system env. **수동으로 만들거나 복제하지 않는다** | 동일(자동) | palmPublicAccess(배포 식별) |

- **secret 규칙**:
  - `PALM_EXTRACTION_SECRET`, `PALM_SESSION_SECRET`, `PALM_TRUSTED_INGRESS_VERIFICATION`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
  - 값을 출력하거나 로그·문서·티켓·Git에 남기지 않는다.
  - 브라우저 코드는 이 이름들을 참조하지 않는다(회귀 테스트와 빌드 번들 검사로 확인).
- **`NEXT_PUBLIC_SUPABASE_URL` 예외**:
  - 이 이름은 기존 앱(브라우저 analytics)이 이미 쓰는 **공개 가능한 프로젝트 URL**이다. 빌드 때 브라우저 번들에 들어가며 비밀이 아니다.
  - Phase 1C 서버 코드도 같은 URL을 서버에서 읽어 service role로 RPC를 호출한다. 이름을 바꾸거나 `PALM_` 복제본을 만들지 않는다.
  - 비밀인 것은 `SUPABASE_SERVICE_ROLE_KEY`뿐이다.
- **Preview 원칙**:
  - Preview는 공개 OFF와 격리 mock(7단계)에만 쓴다. Production secret을 Preview scope에 복사하지 않는다.
  - Preview에서 ingress를 시험한다면 Production과 다른 secret을 쓰고, Preview에서 발급한 토큰은 Preview에서만 쓴다(Production에서는 거부된다).
  - branch별 Preview override가 `PALM_PUBLIC_ENABLED`나 secret을 켜지 않는지 확인한다.

## 1-A. 신뢰 ingress (클라이언트 IP) — TRUSTED INGRESS CONFIGURED / TRUST NOT ESTABLISHED

IP당 세션 발급 한도와 IP당 일 한도는 클라이언트 IP가 위조되지 않아야 의미가 있다. 애플리케이션만으로는 이것을 증명할 수 없다. 그래서 공개 경로는 아래 조건을 모두 만족할 때만 켜진다. 하나라도 빠지면 TRUST NOT ESTABLISHED로 보고 공개 기능은 꺼진다(fail closed).

1. **승인된 ingress 전략 하나**: `PALM_TRUSTED_INGRESS=vercel`. 현재 지원하는 전략은 이것뿐이다.
   - 이 전략은 `x-vercel-forwarded-for` 헤더 하나만 읽는다. `x-forwarded-for`·`x-real-ip`는 대체 경로로도 절대 읽지 않는다.
   - 근거: Vercel 문서(Request headers, 2026-10-01 확인)는 `x-forwarded-for`를 덮어써 외부 IP를 전달하지 않는다고 설명한다. `x-vercel-forwarded-for`는 같은 값이며, 앞단 proxy가 덮어쓰지 않는다고 설명한다.
   - 이것은 플랫폼 설명일 뿐이므로 **이 배포에서** probe로 확인한다.
2. **배포 결합 토큰**: 토큰은 다음을 HMAC(`PALM_SESSION_SECRET`)으로 묶는다.
   - 전략 + 헤더 + `PALM_PUBLIC_ORIGIN` + 배포 식별값
   - 배포 식별값 = `VERCEL_ENV` + `VERCEL_PROJECT_ID` + `VERCEL_GIT_COMMIT_SHA` + `PALM_INGRESS_GENERATION`

   다음 중 하나라도 바뀌면 토큰이 무효가 되고 공개 경로는 꺼진다: 새 커밋 릴리스, 다른 프로젝트, preview↔production, ingress 세대, origin, 세션 키, 전략.
   - `VERCEL=1`과 `VERCEL_DEPLOYMENT_ID`는 실제 Vercel 런타임이라는 증거로 존재만 요구한다.
   - 배포 ID 자체를 결합하지 않는 이유: Vercel은 env 변경에 새 배포가 필요하다. 배포 ID에 묶으면 토큰을 env에 넣는 재배포가 그 토큰을 곧바로 무효로 만든다(순환).
   - 식별값은 서버 env에서만 읽는다. 요청 헤더로 바꿀 수 없다.
3. **probe 절차**: 공개 OFF 상태에서, 같은 배포·같은 UTC 날짜에 실행한다. 원본 IP는 응답·로그에 나오지 않는다.
   ```bash
   # [palm-1a-probe]  secret은 read -rs로 입력받아 stdin curl config로만 전달한다. 응답에서 verificationToken은 지우고 표시한다.
   IFS= read -rs -p 'operator secret (입력은 표시되지 않음): ' PALM_OP_SECRET; echo >&2
   probe() (
     { set +x +v; } 2>/dev/null
     set -o pipefail
     printf 'header = "x-palm-extraction-secret: %s"\nheader = "x-palm-ingress-probe: 192.0.2.77"\n' "$PALM_OP_SECRET" \
       | curl -sS --max-time 20 --config - -X POST "$@" "$ORIGIN/api/palm/ingress-check" 2>/dev/null \
       | python3 -c '
   import json, sys
   try:
       d = json.loads(sys.stdin.read())
   except Exception:
       print("{\"probe\": \"ERROR\"}"); sys.exit(0)
   keep = {k: d[k] for k in ("ingress", "reason", "strategy", "deployment", "ipFingerprint") if k in d}
   keep["tokenIssued"] = isinstance(d.get("verificationToken"), str)
   print(json.dumps(keep))' || echo '{"probe": "ERROR"}'
   )
   # (a) 대조: 위조 헤더 없음
   probe
   # (b) IPv4 위조값 (문서 대역 + 일반 유효 IP)
   probe -H "x-vercel-forwarded-for: 192.0.2.77" -H "x-forwarded-for: 192.0.2.77" -H "x-real-ip: 192.0.2.77"
   probe -H "x-vercel-forwarded-for: 8.8.8.8" -H "x-forwarded-for: 8.8.8.8"
   # (c) IPv6 위조값과 목록 위조값
   probe -H "x-vercel-forwarded-for: 2606:4700:4700::1111"
   probe -H "x-vercel-forwarded-for: 8.8.4.4, 1.1.1.1" -H "x-forwarded-for: 8.8.4.4, 1.1.1.1"
   unset PALM_OP_SECRET
   ```
   **통과 조건**: 모든 응답이 `established`이고, `deployment.commit`이 배포한 커밋과 같으며, `ipFingerprint`가 (a)~(c)에서 **모두 같아야** 한다.
   - fingerprint가 하나라도 다르면 위조값이 quota identity를 바꾼 것이므로 공개하지 않는다.
   - `spoofed-value-passed-through`·`trusted-header-missing`·`trusted-header-invalid-or-multiple`·`deployment-identity:*`이 나와도 공개하지 않는다.
   - 토큰은 이 절차에서 화면에 표시되지 않는다(`tokenIssued: true`만 표시). 통과했을 때만 5단계에서 1-B의 `palm-1b-install`로 설치한다. 그 스크립트는 probe 재발급값을 stdin으로 곧바로 설치한다. 토큰 값은 채팅·로그·티켓·Git에 붙이지 않는다.
   - probe 한 번의 응답만으로는 외부 검증이 끝난 것이 아니다. 이 절차 전체를 통과해야 검증 완료다.
4. **두 네트워크 확인**: 서로 다른 두 네트워크(예: LTE와 사무실망)에서 (a)를 실행한다.
   - **같은 배포·같은 UTC 날짜**에서 해야 한다. fingerprint는 배포 식별값과 UTC 날짜에 따라 바뀐다.
   - 두 fingerprint가 달라야 한다. 같다면 모든 사용자가 한 IP로 보이는 구성이므로 공개하지 않는다.
   - 이 점검의 목적은 IP가 하나로 합쳐지는 구성을 찾는 것뿐이며, overwrite를 증명하지는 않는다.
   - fingerprint는 비교에만 쓰고, 제품 analytics나 DB에 저장하지 않는다.
5. **우회 경로 없음 확인**: 공개 도메인과 배포 URL(`*.vercel.app`) 모두에서 3번 절차가 통과해야 한다. Vercel 외의 다른 origin이나 proxy에서 같은 앱을 서비스하지 않는다.
6. **지원하지 않는 형태**: Vercel 외 배포, Vercel 앞단의 별도 proxy/CDN, git이 아닌 배포. 새 전략 추가는 별도 설계·검수 대상이다.

## 1-B. 설치된 토큰 확인 (probe 성공 ≠ 설치 토큰 유효) — 공개 OFF · OpenAI 0회

공개 OFF 동안에는 `PALM_PUBLIC_ENABLED=false`라서 토큰과 무관하게 공개 config가 비활성이다. 즉 **설치된 토큰이 맞는지는 공개 경로의 동작으로 확인할 수 없다.** 이 절은 설치 상태만 확인한다. 실행 중 config의 최종 확인은 8단계의 1-C(승인 후 session)에서 한다.

### 안전 수칙 (아래 모든 스크립트 공통)

- **실행 환경**: 운영자 개인 터미널에서만 실행한다. 기록·공유되는 셸, CI, 화면 녹화·로그 수집 중인 환경에서는 실행하지 않는다.
- **xtrace 차단**: 각 스크립트는 `( ... )` subshell로 실행되며, 첫 줄에서 `set -x`·`set -v`를 끈다. 호출한 셸에 xtrace가 켜져 있어도 비밀값이 trace되지 않는다.
- **입력 방식**:
  - operator secret은 `read -rs`로 입력받는다. 화면 echo와 history에 남지 않는다.
  - curl에는 stdin config(`--config -`)로만 전달하므로, 프로세스 목록(argv)에 보이지 않는다.
- **토큰 처리**: 토큰은 셸 변수 안에서만 다룬다. CLI에 넘길 때는 stdin을 쓰고, `--value`처럼 명령 인자로 넘기지 않는다.
- **임시 파일**:
  - 저장소 밖 `mktemp -d`에 `umask 077`로 만든다.
  - `trap`으로 정상 종료·실패·중단(INT/TERM) 어느 경우에도 삭제한다.
  - env 파일은 `source`하지 않고, 필요한 한 줄만 읽는다.
- **출력**: 상태 문자열과 boolean만 출력한다. 토큰·secret·cookie·CSRF 값은 출력하지 않는다.
- **로그인**: Vercel CLI는 미리 `vercel login`으로 로그인해 둔다. `--token` 인자는 쓰지 않는다(argv 노출).
- **CLI 버전 고정**: `npx -y vercel@64.7.0`. 아래 옵션은 이 버전의 `--help`로 확인했다.
  - `env pull --project/--id/--yes`, `env list --environment/--project`, `env add --environment/--project/--type/--force/--yes`
  - `project inspect`, `inspect`, `redeploy`, `rollback`
  - 전역 `--scope/--cwd/--non-interactive`

### 대상 식별값 (비밀 아님 — 먼저 셸에 설정)

```bash
# [palm-1b-targets] 비밀이 아닌 대상 식별값만 둔다. 실제 값은 대시보드에서 확인해 직접 입력한다.
TEAM='your-team-slug'                      # Vercel 팀 slug (--scope)
PROJECT_ID='prj_xxxxxxxxxxxxxxxx'          # 정확한 프로젝트 ID (이름 대신 ID 사용)
ORIGIN='https://your-production-origin'    # PALM_PUBLIC_ORIGIN과 같은 값
DPL_ID='dpl_xxxxxxxxxxxxxxxx'              # 지금 Production 도메인에 연결된 배포 ID
EXPECTED_COMMIT='abcdef1'                  # 그 배포의 커밋 앞 7자리
```

### 1단계 — 프로젝트·배포 확인 (잘못 연결된 `.vercel/project.json` 배제)

- 모든 CLI 호출은 빈 임시 디렉터리를 `--cwd`로 쓰고 `--scope`·`--project`(또는 대상 ID)를 명시한다. 그래서 저장소나 다른 디렉터리의 프로젝트 연결(link)을 읽지 않는다.
- 이 단계의 출력에는 비밀값이 없다.

```bash
# [palm-1b-inspect]
(
  { set +x +v; } 2>/dev/null
  set -u
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || exit 1
  trap 'rm -rf "$WORK"' EXIT
  trap 'exit 130' INT TERM
  vc() { npx -y vercel@64.7.0 --non-interactive --scope "$TEAM" --cwd "$WORK" "$@"; }
  vc project inspect "$PROJECT_ID"
  vc inspect "$DPL_ID"
)
```

눈으로 확인할 것(하나라도 다르면 중단):
- `project inspect`의 ID가 `PROJECT_ID`와 같고, 프로젝트 이름이 의도한 Destiny Code 프로젝트다.
- `inspect`의 배포가 Production 대상이고 준비 완료(Ready) 상태다.
- 그 배포의 alias에 `ORIGIN`의 호스트가 있고(= 지금 실제로 서비스 중인 배포), git 커밋이 `EXPECTED_COMMIT`이다.
- 배포 생성 시각이 토큰 env를 바꾼 시각보다 **뒤**다. env 변경은 다음 배포부터만 적용된다.

### 2단계 — 재발급 토큰과 설치값의 비공개 대조

이 단계는 두 값을 비교해 상태 하나만 출력한다.
- **재발급 토큰**: 실행 중 배포의 probe가 발급한 값. `deployment.commit`이 `EXPECTED_COMMIT`과 같을 때만 사용한다.
- **설치값**: 그 배포(`--id "$DPL_ID"`)에 들어간 `PALM_TRUSTED_INGRESS_VERIFICATION`.

출력되는 상태:

| 출력 | 의미 | 다음 행동 |
|---|---|---|
| `MATCH` | 설치값이 실행 중 배포의 재발급 토큰과 같다 | 설치 확인 완료. 실행 중 config의 최종 확인은 1-C |
| `MISMATCH` | 읽을 수 있는 설치값이 다르다(빈 값 포함) | 중단 → 아래 "안전한 재설정" |
| `UNREADABLE` | 값이 Vercel **Secret**이라 CLI가 읽을 수 없다. Production 기본 type은 Secret이다 | **검증 완료가 아니다** → 아래 "읽기 불가 처리" |
| `MISSING` | Production scope에 변수가 없다 | 중단 → 설치 후 같은 커밋 재배포 |
| `ERROR-PROBE` / `ERROR-PULL` / `ERROR-LIST` | probe 실패, `established` 아님, 커밋 불일치, CLI 실패 | **검증 완료가 아니다**. 원인 확인 후 재시도 |

읽기 불가 판정 원리: Vercel 문서상 `vercel env pull`은 읽을 수 없는 Secret이면 **로컬 파일에 이미 있는 값을 유지**한다. 그래서 무작위 sentinel을 미리 써 두고, pull 뒤에도 sentinel이 그대로 남아 있으면 `UNREADABLE`로 판정한다. 변수가 아예 없는 경우도 sentinel이 남으므로, 이 경우는 `env list` 이름 존재 여부로 먼저 가려 `MISSING`으로 분리한다. 읽기 불가를 빈 값이나 불일치로 단정하지 않는다.

```bash
# [palm-1b-compare]
(
  { set +x +v; } 2>/dev/null
  set -u -o pipefail
  umask 077
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || { echo ERROR-PULL; exit 1; }
  cleanup() { rm -rf "$WORK"; unset OP_SECRET ISSUED INSTALLED SENTINEL RESP; }
  trap cleanup EXIT
  trap 'exit 130' INT TERM
  status() { echo "$1"; exit 0; }
  vc() { npx -y vercel@64.7.0 --non-interactive --scope "$TEAM" --cwd "$WORK" "$@"; }

  IFS= read -rs -p 'operator secret (입력은 표시되지 않음): ' OP_SECRET; echo >&2
  # 1) 실행 중 배포에서 토큰 재발급 — secret은 stdin curl config로만 전달
  RESP=$(printf 'header = "x-palm-extraction-secret: %s"\nheader = "x-palm-ingress-probe: 192.0.2.77"\n' "$OP_SECRET" \
    | curl -sS --max-time 20 --config - -X POST "$ORIGIN/api/palm/ingress-check" 2>/dev/null) || status ERROR-PROBE
  unset OP_SECRET
  ISSUED=$(python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
except Exception:
    sys.exit(0)
if d.get("ingress") == "established" and (d.get("deployment") or {}).get("commit") == sys.argv[1]:
    print(d.get("verificationToken", ""))
' "$EXPECTED_COMMIT" <<<"$RESP")
  unset RESP
  [ -n "$ISSUED" ] || status ERROR-PROBE

  # 2) Production scope에 변수 이름이 있는지 (값은 보지 않는다)
  vc env list --environment production --project "$PROJECT_ID" > "$WORK/list.txt" 2>/dev/null || status ERROR-LIST
  grep -qw 'PALM_TRUSTED_INGRESS_VERIFICATION' "$WORK/list.txt" || status MISSING

  # 3) 실행 중 배포의 설치값 — sentinel을 미리 써 두고 pull (Secret이면 sentinel이 유지된다)
  SENTINEL="__palm_sentinel_$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')__"
  printf 'PALM_TRUSTED_INGRESS_VERIFICATION=%s\n' "$SENTINEL" > "$WORK/deploy.env"
  vc env pull "$WORK/deploy.env" --id "$DPL_ID" --project "$PROJECT_ID" --yes > /dev/null 2>&1 || status ERROR-PULL
  [ "$(grep -c '^PALM_TRUSTED_INGRESS_VERIFICATION=' "$WORK/deploy.env")" = 1 ] || status ERROR-PULL
  INSTALLED=$(sed -n 's/^PALM_TRUSTED_INGRESS_VERIFICATION=//p' "$WORK/deploy.env" | tr -d '"')
  [ "$INSTALLED" = "$SENTINEL" ] && status UNREADABLE
  [ "$INSTALLED" = "$ISSUED" ] && status MATCH
  status MISMATCH
)
```

### 읽기 불가(`UNREADABLE`) 처리 — 검증 완료로 표시하지 않는다

- Secret을 Config로 낮춰서 비교하지 **않는다**.
- 두 선택지 중 하나를 운영 기록에 남긴다(토큰 값 없이 상태만).
  1. **검증 보류(UNVERIFIED-SECRET)**: 설치값을 직접 대조하지 못했다고 기록한다. 실행 중 config는 8단계 1-C session 확인(승인 후)으로만 판정한다. 그 전까지는 "설치 확인됨"으로 보고하지 않는다.
  2. **안전한 재설정(INSTALLED-FROM-PROBE)**: 아래 `palm-1b-install` 스크립트로 실행 중 배포의 재발급 토큰을 화면을 거치지 않고 stdin으로 곧바로 Production Secret에 다시 설치한다. 그런 다음 **같은 커밋**을 재배포하고(대시보드 Redeploy 또는 `vercel redeploy "$DPL_ID"`), 1단계를 새 배포 ID로 다시 확인한다.
     - 이렇게 기록하는 것은 "probe가 발급한 값을 사람이 다루지 않고 설치했다"는 설치 경로 증거다. 값 대조가 아니다.
     - 최종 확인은 여전히 1-C다.
- 이 스크립트는 `vercel env add --environment production --force`를 쓴다. Production 환경의 값만 추가·교체한다.
  - `vercel env update`는 그 변수가 걸쳐 있는 **모든 환경**을 바꾸므로 쓰지 않는다.
  - 실행 뒤 대시보드에서 이 변수가 Production에만 있는지 확인한다(R-1 Preview 원칙).
- 같은 스크립트를 5단계 최초 설치에도 쓴다. 출력은 `INSTALLED-REDEPLOY-SAME-COMMIT-NEXT` 또는 `INSTALL-ERROR`뿐이다.

```bash
# [palm-1b-install]  설치·재설정: probe 재발급 토큰 → stdin → Production Secret (화면·argv·history에 값 없음)
(
  { set +x +v; } 2>/dev/null
  set -u -o pipefail
  umask 077
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/palm.XXXXXX") || { echo INSTALL-ERROR; exit 1; }
  cleanup() { rm -rf "$WORK"; unset OP_SECRET ISSUED RESP; }
  trap cleanup EXIT
  trap 'exit 130' INT TERM
  status() { echo "$1"; exit 0; }
  vc() { npx -y vercel@64.7.0 --non-interactive --scope "$TEAM" --cwd "$WORK" "$@"; }

  IFS= read -rs -p 'operator secret (입력은 표시되지 않음): ' OP_SECRET; echo >&2
  RESP=$(printf 'header = "x-palm-extraction-secret: %s"\nheader = "x-palm-ingress-probe: 192.0.2.77"\n' "$OP_SECRET" \
    | curl -sS --max-time 20 --config - -X POST "$ORIGIN/api/palm/ingress-check" 2>/dev/null) || status INSTALL-ERROR
  unset OP_SECRET
  ISSUED=$(python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
except Exception:
    sys.exit(0)
if d.get("ingress") == "established" and (d.get("deployment") or {}).get("commit") == sys.argv[1]:
    print(d.get("verificationToken", ""))
' "$EXPECTED_COMMIT" <<<"$RESP")
  unset RESP
  [ -n "$ISSUED" ] || status INSTALL-ERROR
  # --environment production 만 대상, 같은 환경의 기존 값은 --force로 교체 (값은 stdin)
  printf '%s' "$ISSUED" | vc env add PALM_TRUSTED_INGRESS_VERIFICATION --environment production \
    --project "$PROJECT_ID" --type secret --force --yes > /dev/null 2>&1 || status INSTALL-ERROR
  status INSTALLED-REDEPLOY-SAME-COMMIT-NEXT
)
```

### 3단계 — 공개 OFF 게이트 확인 (실제 API 계약)

- 기대값: session `200`, `enabled:false`, `__Host-palm_session` cookie 없음 / analyze 공개 분기 `503`, `error.code=UNAVAILABLE` / events `204`.
- cookie·CSRF 값은 출력하지 않고 boolean만 출력한다. 이 확인은 OFF kill switch 확인이며, 토큰 유효성 증명이 아니다.

```bash
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
        return ""
try:
    sb = json.loads(load("s.body"))
except Exception:
    sb = None
try:
    ab = json.loads(load("a.body"))
except Exception:
    ab = None
session_off = s == "200" and isinstance(sb, dict) and sb.get("enabled") is False
no_cookie = "__host-palm_session=" not in load("s.head").lower()
analyze_off = a == "503" and isinstance(ab, dict) and (ab.get("error") or {}).get("code") == "UNAVAILABLE"
events_off = e == "204"
print(f"session_off={session_off} no_session_cookie={no_cookie} analyze_503_unavailable={analyze_off} events_204={events_off}")
print("OFF-CONFIRMED" if (session_off and no_cookie and analyze_off and events_off) else "OFF-NOT-CONFIRMED")
PY
)
```

## 1-C. 공개 ON 확인 — 8단계, 별도 운영 승인 후에만

- 이 절은 지금 수행하지 않는다.
- 전제: migration 적용, N-1 PASS, 실기기 mock PASS, 1-B 결과 기록, 공개 ON 별도 승인.
- 실패하면 OpenAI 유료 호출은 금지이며 곧바로 1-D로 간다.

1. **OFF 배포 ID 기록**: ON 전환 전에 지금 Production에 연결된 OFF 배포 ID를 `OFF_DPL_ID`로 기록한다. 1-D의 빠른 복귀 대상이다.
2. **ON 설정과 재배포**:
   - Production scope에서 `PALM_EXTRACTION_ENABLED=true`, `PALM_PUBLIC_ENABLED=true`로 바꾼다. 코드상 둘 다 true여야 공개가 켜진다.
   - `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 설정돼 있어야 한다.
   - **같은 커밋**을 재배포한다. 새 커밋이면 토큰이 무효가 되어 공개는 켜지지 않는다.
   - env 변경만으로는 실행 중인 배포가 바뀌지 않는다.
   - 이 재배포부터 공개 경로가 실제로 열리며 비용 한도가 적용된다.
3. **1단계(`palm-1b-inspect`)로 확인**: 새 배포가 Production 도메인에 연결됐고 커밋이 같은지 확인한다.
4. **session 확인 — analyze 호출 전**: cookie를 보내지 않는 session POST 한 번으로 판정한다. 이 요청은 OpenAI를 호출하지 않는다. 세션 발급은 DB 한도 1회를 쓴다.

```bash
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
import json, os, sys
code, work = sys.argv[1:3]
def load(name):
    try:
        with open(os.path.join(work, name), errors="replace") as f:
            return f.read()
    except OSError:
        return ""
try:
    body = json.loads(load("body"))
except Exception:
    body = None
enabled = isinstance(body, dict) and body.get("enabled") is True
csrf_present = isinstance(body, dict) and isinstance(body.get("csrfToken"), str) and len(body["csrfToken"]) > 0
cookies = [l for l in load("head").splitlines() if l.lower().startswith("set-cookie:") and "__Host-palm_session=" in l]
c = cookies[0] if len(cookies) == 1 else ""
cookie_ok = bool(c) and all(x in c for x in ("HttpOnly", "Secure", "SameSite=Strict", "Path=/")) and "domain=" not in c.lower()
print(f"http_200={code == '200'} enabled_true={enabled} csrf_present={csrf_present} session_cookie_ok={cookie_ok}")
print("SESSION-PASS" if (code == "200" and enabled and csrf_present and cookie_ok) else "SESSION-FAIL")
PY
)
```

- **성공 조건(전부 충족)**: `SESSION-PASS`. 즉 HTTP 200, `enabled:true`, CSRF token 존재, `__Host-palm_session` cookie가 정확히 1개, 속성 `HttpOnly`·`Secure`·`SameSite=Strict`·`Path=/`, `Domain` 없음.
- **그 밖의 모든 결과는 실패다**: `SESSION-FAIL`, HTTP 429(한도 초과면 `enabled:true`이지만 cookie가 없다), 403·503·000(네트워크 오류·timeout), JSON 파싱 실패, cookie 없음·중복·속성 불일치. → 즉시 1-D. OpenAI 호출 금지.
5. **SESSION-PASS 뒤에만**: 별도로 승인된 live OpenAI 1회 smoke를 진행한다(동의 사진, 결과 기록). 이것도 실패하면 1-D.
6. **공개 유지 여부는 별도 결정**이다.

## 1-D. 즉시 OFF 복귀 (ON 확인 실패·live 실패·이상 징후)

1. **가장 빠른 복귀**: 1-C 1번에서 기록한 OFF 배포로 되돌린다. 대시보드 Instant Rollback 또는 다음 명령을 쓴다. 되돌린 배포는 자신이 만들어질 때의 OFF env를 그대로 쓴다.
   ```bash
   # [palm-rollback]
   npx -y vercel@64.7.0 rollback "$OFF_DPL_ID" --scope "$TEAM" --yes
   ```
2. **설정도 OFF로 고정**: Production scope의 `PALM_PUBLIC_ENABLED=false`(필요하면 `PALM_EXTRACTION_ENABLED=false`)로 바꾼다. 이후 배포가 다시 ON으로 나가지 않게 하기 위해서다. 1번을 쓸 수 없으면 이 설정 후 **같은 커밋을 재배포**한다. env 변경만으로는 실행 중 배포가 바뀌지 않는다.
3. **OFF 복귀 완료 확인(둘 다 충족해야 완료)**:
   - `palm-1b-inspect`(대상 `DPL_ID`를 현재 Production 배포로 바꿔서)로, Production 도메인에 연결된 배포가 OFF 배포(또는 OFF 설정 뒤 새로 만든 배포)인지 확인한다.
   - `palm-off-gate`가 `OFF-CONFIRMED`를 출력한다.
   - `OFF-NOT-CONFIRMED`이면 1~2번을 반복하고, 확인될 때까지 어떤 Palm 시험·OpenAI 호출도 하지 않는다.

## 2. Kill switch

- 전체 provider 중단: `PALM_EXTRACTION_ENABLED=false`. operator 경로도 함께 멈춘다.
- 신뢰 ingress 무효화: `PALM_TRUSTED_INGRESS_VERIFICATION`을 비우거나 `PALM_INGRESS_GENERATION`을 올리면 공개 경로가 꺼진다. 새 커밋을 배포해도 자동으로 무효가 된다.
- 공개 경로만 중단: `PALM_PUBLIC_ENABLED=false`.
- 끄면 결과 화면에 새 분석 입력이 나타나지 않는다. 이미 저장된 손바닥 결과는 기기에서 계속 표시되고, 기본 운명 코드 결과는 영향이 없다.
- DB·설정 장애가 나면 공개 호출은 provider 호출 0회로 503을 반환한다(fail closed).

## 3. 비용 통제의 의미와 한계

- 한도는 운영 상한이며 통계적 근거가 있는 값이 아니다. 세션·IP·전체 한도, 동시성, 같은 요청 ID·같은 이미지 중복을 공유 DB의 atomic 예약으로 막는다.
- 익명 세션은 계정 인증이 아니다. 세션 재발급·IP 분산을 완전히 막지는 못하며, 전체 일 한도가 마지막 안전장치다.
- 예약한 호출은 timeout·응답 유실이 나도 환불하지 않는다(`uncertain`). 자동으로 다시 호출하지도 않는다. exactly-once 처리는 보장하지 않는다.
- 모든 공유 DB 호출에는 시간 상한(2.5초, abort 포함)이 있다.
  - provider 이전 DB가 지연되면 provider 호출 0회로 503을 반환한다.
  - provider 이후 finalize가 확인되지 않아도 이미 받은 관찰은 그대로 돌려준다. 이때 원장은 `provider-started`로 남고, lease(120초)가 만료되면 `uncertain`이 된다. 그동안 그 호출은 동시성 슬롯과 일 한도를 계속 차지하며, 같은 이미지는 재분석하지 않는다.
  - analytics는 1초 상한의 best-effort이며, 늦으면 기록이 빠질 수 있다.
  - 응답 상한은 30초 + 2.5초 + 1초로 route `maxDuration` 40초 안이다.
- 이벤트 본문은 스트리밍 중 512 bytes를 넘으면 즉시 중단한다. 읽기 상한은 2초다.
- 같은 NAT를 쓰는 사용자들은 IP 한도를 공유할 수 있다.
- `store:false`는 OpenAI 측 보관이 0이라는 뜻이 아니다. 안내 문구도 그렇게 약속하지 않는다.

## 4. 저장 원칙

- 원본 사진은 서버·DB·로그·analytics 어디에도 저장하지 않는다.
- 사용자가 저장하면 검증된 관찰·결정적 해석·비교만 기기의 `destiny_palm_supplements_v1`에 저장한다.
- 개선용 사진 수집이나 동의 UI는 없다(`improvementRetentionEnabled=false`). 보관·삭제·철회 정책이 준비된 뒤 별도로 설계한다.
