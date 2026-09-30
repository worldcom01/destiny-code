# Palm Phase 1C — 운영 절차 (공개 손바닥 패턴 분석)

기본값은 **꺼짐**(`PALM_PUBLIC_ENABLED=false`)이다. 아래 1~7단계와 별도 승인된 live smoke(8단계) 전에는 켜지 않는다.
설계: `docs/ai/CODEX_REVIEW.md` "Palm Phase 1C", `docs/ai/DECISIONS.md` AD-007~009.

> **신뢰 ingress 검증은 릴리스·보안 설정에 결합된다. 새 커밋, 환경·프로젝트·origin·세션 키·전략 변경 또는 ingress 세대 변경 시 재검증한다. 같은 설정의 같은 커밋에서 토큰을 적용하는 env-only 재배포는 기존 토큰을 유지한다.**
> 코드 변경 없이 proxy 토폴로지·도메인·ingress 동작 등 신뢰 IP에 영향을 주는 인프라를 바꿀 때도 먼저 공개 OFF로 전환하고 `PALM_INGRESS_GENERATION`을 변경한 뒤 재검증한다. 배포 ID 변경만으로 토큰이 자동 무효화되지는 않는다.

## 1. 통제된 준비 순서 (그대로 실행 가능한 체크리스트)

**공개 사용자 접근(`PALM_PUBLIC_ENABLED`)과 운영자 ingress 검증은 별개다.**
- ingress probe(`/api/palm/ingress-check`)는 `PALM_PUBLIC_ENABLED=false`, `PALM_EXTRACTION_ENABLED=false` 상태에서 동작한다. OpenAI·DB를 호출하지 않는다.
- probe는 공개 기능을 켜지 않는다.
- 아래 1~7단계 동안 `PALM_PUBLIC_ENABLED`는 **계속 `false`**다. 8단계 이전에는 켜지 않는다.

1. **공개 OFF로 시작**: `PALM_PUBLIC_ENABLED=false`로 둔다. 이미 켜져 있으면 먼저 끄고 배포한다.
2. **서버 인프라 배포 (공개 OFF)**: 아래 값은 모두 서버 전용이다. `NEXT_PUBLIC_`를 붙이지 않고, 값을 출력하거나 로그에 남기지 않는다.
   - `PALM_PUBLIC_ENABLED=false`
   - `PALM_EXTRACTION_ENABLED`: 준비 중에는 `false`를 권장한다(probe와 무관).
   - `PALM_EXTRACTION_SECRET`: probe 호출용 운영자 secret.
   - `PALM_SESSION_SECRET`: 32자 이상. 운영자 secret과 다른 값이어야 한다.
   - `PALM_PUBLIC_ORIGIN`: 정확한 https origin.
   - `PALM_TRUSTED_INGRESS=vercel`
   - `PALM_INGRESS_GENERATION`: 예 `g1`. 도메인·proxy·ingress 구성을 바꿀 때마다 올린다.
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`: 준비해 둔다.
   - `PALM_TRUSTED_INGRESS_VERIFICATION`: 이 단계에서는 **비워 둔다**.
   - Vercel 프로젝트 설정에서 **Enable access to System Environment Variables**를 켠다. 필요한 값은 `VERCEL`, `VERCEL_ENV`, `VERCEL_PROJECT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID`다.
   - **git 연동 배포**여야 한다. CLI 등 커밋 SHA가 없는 배포는 지원하지 않으며 fail closed된다.
   - 로그/APM: 요청 body와 헤더 capture를 끈다. cookie, `x-palm-csrf`, IP, 이미지가 로그에 남지 않게 한다.
3. **DB (별도 승인 후)**: 공개 OFF 상태에서 진행한다.
   - Supabase SQL Editor에서 `supabase/palm-public.sql`을 transaction으로 적용한다. 기존 `analysis_results`와 그 정책은 바꾸지 않는다.
   - anon/authenticated의 테이블 접근과 RPC 실행이 거부되는지 확인하고, service role 동작을 확인한다.
   - `select palm_cleanup();`을 예약한다(예: pg_cron 5분 주기). 실제 삭제 시점은 예약 주기만큼 늦어질 수 있다.
4. **ingress probe (공개 OFF, 비유료)**: 아래 1-A 절차를 모두 수행한다.
   - 대조 요청, 여러 형태의 위조값, 두 네트워크 비교, 배포 URL 비교를 모두 포함한다.
   - 모든 확인은 **같은 배포**, **같은 UTC 날짜**에 한다.
5. **배포 결합 검증값 적용 (여전히 공개 OFF)**:
   - 4단계 토큰을 `PALM_TRUSTED_INGRESS_VERIFICATION`에 넣고, **같은 커밋을** env만 바꿔 재배포한다(`PALM_PUBLIC_ENABLED=false` 유지).
   - 같은 커밋의 env-only 재배포는 배포 식별값이 같으므로 토큰이 유효하다.
   - 재배포 뒤 probe를 한 번 더 실행해 같은 `deployment.commit`에서 `established`인지 확인한다.
   - 새 커밋을 배포했다면 4단계부터 다시 한다.
6. **DB-only 다중 연결 동시성 smoke (N-1, live 전 필수)**:
   - 별도 연결로 다음을 검사한다: 같은 요청 ID 동시 reserve, 세션·전체 한도 직전 경합, lease 만료 복구, finalize 경합.
   - reserve 성공 수가 한도를 넘지 않고, 소비 예산이 환불되지 않는지 확인한다.
   - OpenAI provider는 연결하지 않는다.
7. **실기기 MOCK 경로**: 격리된 preview나 로컬 mock harness에서 검사한다. production의 공개 경로를 mock처럼 켜지 않는다.
   - iPhone 카메라·갤러리, HEIC 안내, 큰 사진
   - Android JPEG/WebP
   - 취소·실패·재시도, 저장 후 다시 열기, A/B 결과 격리, 삭제 중 늦은 응답, 공유, 429·비활성 안내
8. **여기까지 모두 통과한 뒤에만**: 별도 승인을 받아 live OpenAI 1회 smoke를 하고, 공개 활성화 여부를 따로 결정한다.

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
   probe() { curl -sS -X POST -H "x-palm-extraction-secret: $PALM_EXTRACTION_SECRET" -H "x-palm-ingress-probe: 192.0.2.77" "$@" "$ORIGIN/api/palm/ingress-check"; echo; }
   # (a) 대조: 위조 헤더 없음
   probe
   # (b) IPv4 위조값 (문서 대역 + 일반 유효 IP)
   probe -H "x-vercel-forwarded-for: 192.0.2.77" -H "x-forwarded-for: 192.0.2.77" -H "x-real-ip: 192.0.2.77"
   probe -H "x-vercel-forwarded-for: 8.8.8.8" -H "x-forwarded-for: 8.8.8.8"
   # (c) IPv6 위조값과 목록 위조값
   probe -H "x-vercel-forwarded-for: 2606:4700:4700::1111"
   probe -H "x-vercel-forwarded-for: 8.8.4.4, 1.1.1.1" -H "x-forwarded-for: 8.8.4.4, 1.1.1.1"
   ```
   **통과 조건**: 모든 응답이 `established`이고, `deployment.commit`이 배포한 커밋과 같으며, `ipFingerprint`가 (a)~(c)에서 **모두 같아야** 한다.
   - fingerprint가 하나라도 다르면 위조값이 quota identity를 바꾼 것이므로 공개하지 않는다.
   - `spoofed-value-passed-through`·`trusted-header-missing`·`trusted-header-invalid-or-multiple`·`deployment-identity:*`이 나와도 공개하지 않는다.
   - 통과했을 때만 `verificationToken`을 사용한다. 토큰 값은 채팅·로그·티켓에 붙이지 않는다.
   - probe 한 번의 응답만으로는 외부 검증이 끝난 것이 아니다. 이 절차 전체를 통과해야 검증 완료다.
4. **두 네트워크 확인**: 서로 다른 두 네트워크(예: LTE와 사무실망)에서 (a)를 실행한다.
   - **같은 배포·같은 UTC 날짜**에서 해야 한다. fingerprint는 배포 식별값과 UTC 날짜에 따라 바뀐다.
   - 두 fingerprint가 달라야 한다. 같다면 모든 사용자가 한 IP로 보이는 구성이므로 공개하지 않는다.
   - 이 점검의 목적은 IP가 하나로 합쳐지는 구성을 찾는 것뿐이며, overwrite를 증명하지는 않는다.
   - fingerprint는 비교에만 쓰고, 제품 analytics나 DB에 저장하지 않는다.
5. **우회 경로 없음 확인**: 공개 도메인과 배포 URL(`*.vercel.app`) 모두에서 3번 절차가 통과해야 한다. Vercel 외의 다른 origin이나 proxy에서 같은 앱을 서비스하지 않는다.
6. **지원하지 않는 형태**: Vercel 외 배포, Vercel 앞단의 별도 proxy/CDN, git이 아닌 배포. 새 전략 추가는 별도 설계·검수 대상이다.

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
