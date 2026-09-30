# Palm Phase 1C — 운영 절차 (공개 손바닥 패턴 분석)

기본값은 **꺼짐**(`PALM_PUBLIC_ENABLED=false`)이다. 아래 준비와 별도 승인된 live smoke 전에는 켜지 않는다.
설계: `docs/ai/CODEX_REVIEW.md` "Palm Phase 1C", `docs/ai/DECISIONS.md` AD-007~009.

## 1. 켜기 전 준비

1. **DB**: Supabase SQL Editor에서 `supabase/palm-public.sql`을 실행한다.
   - 기존 `analysis_results`와 그 정책은 바꾸지 않는다.
   - anon/authenticated에는 새 테이블 권한도, RPC 실행 권한도 없다. service role만 쓸 수 있다.
2. **정리 작업**: `select palm_cleanup();`을 매일 한 번 이상 실행하도록 예약한다(예: Supabase cron).
   - 요청 ledger·세션 발급·이벤트 한도 기록은 24시간 뒤, 이벤트는 30일 뒤 삭제된다.
   - RPC는 만료된 행을 판단에 쓰지 않는다.
3. **서버 env**: 아래 값은 서버 전용이며 `NEXT_PUBLIC_`를 붙이지 않는다. 값은 출력하거나 로그로 남기지 않는다.
   - `OPENAI_API_KEY`, `PALM_EXTRACTION_ENABLED=true`
   - `PALM_PUBLIC_ENABLED=true`
   - `PALM_SESSION_SECRET`: 32자 이상. 운영자 secret과 달라야 하며, 같으면 비활성화된다.
   - `PALM_PUBLIC_ORIGIN`: 정확한 https origin
   - `PALM_TRUSTED_INGRESS=vercel`과 `PALM_TRUSTED_INGRESS_VERIFICATION`: 아래 1-A 절차로 받은 토큰. 둘 중 하나라도 없으면 공개 기능은 켜지지 않는다.
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. **신뢰 ingress 확인 (1-A, 필수)**: 아래 1-A 절차를 통과하기 전에는 공개를 켤 수 없다.
5. **로그/APM**: 요청 body와 헤더 capture를 끈다. cookie, `x-palm-csrf`, IP, 이미지가 로그에 남지 않게 한다. 앱 코드는 정규화된 오류 code만 남긴다.
6. **실기기 확인**: mock이나 공개 OFF 상태에서 다음을 먼저 확인한다.
   - iPhone 카메라·갤러리, HEIC 안내, 큰 사진
   - Android JPEG/WebP
   - 취소·실패·재시도, 저장 후 다시 열기, A/B 결과 격리, 공유, 429·비활성 안내

## 1-A. 신뢰 ingress (클라이언트 IP) — TRUSTED INGRESS CONFIGURED / TRUST NOT ESTABLISHED

IP당 세션 발급 한도와 IP당 일 한도는 클라이언트 IP가 위조되지 않아야 의미가 있다. 애플리케이션만으로는 이것을 증명할 수 없다. 그래서 공개 경로는 아래 조건을 모두 만족할 때만 켜진다. 하나라도 빠지면 TRUST NOT ESTABLISHED로 보고 공개 기능은 꺼진다(fail closed).

1. **승인된 ingress 전략 하나**: `PALM_TRUSTED_INGRESS=vercel`. 현재 지원하는 전략은 이것뿐이다.
   - 이 전략은 `x-vercel-forwarded-for` 헤더 하나만 읽는다.
   - `x-forwarded-for`·`x-real-ip` 같은 다른 헤더는 대체 경로로도 절대 읽지 않는다. 임의 헤더 이름을 설정할 수 있던 `PALM_TRUSTED_IP_HEADER`는 제거됐다.
   - 근거: Vercel 문서(Request headers, 2026-10-01 확인)는 `x-forwarded-for`를 덮어써 외부 IP를 전달하지 않는다고 설명한다. 또 `x-vercel-forwarded-for`는 같은 값이며, Vercel 앞에 둔 다른 proxy가 덮어쓰지 않는다고 설명한다.
   - 이것은 플랫폼 설명일 뿐이다. 아래 2번 probe로 **이 배포에서** 실제로 확인해야 한다.
2. **배포 환경 probe**: 공개 OFF 상태에서 운영자가 실행한다. 비유료이며 provider·DB를 호출하지 않는다.
   ```bash
   curl -sS -X POST "$ORIGIN/api/palm/ingress-check" \
     -H "x-palm-extraction-secret: $PALM_EXTRACTION_SECRET" \
     -H "x-palm-ingress-probe: 192.0.2.77" \
     -H "x-vercel-forwarded-for: 192.0.2.77" \
     -H "x-forwarded-for: 192.0.2.77" \
     -H "x-real-ip: 192.0.2.77"
   ```
   - 응답이 `{"ingress":"established", ...}`이면 ingress가 외부에서 넣은 값을 덮어쓴 것이다. 이때 받은 `verificationToken`을 `PALM_TRUSTED_INGRESS_VERIFICATION`에 서버 env로 넣는다. 토큰 값은 채팅·로그에 붙이지 않는다.
   - `spoofed-value-passed-through`·`trusted-header-missing`·`trusted-header-invalid-or-multiple`이 나오면 공개하지 않는다.
   - 토큰은 전략·`PALM_PUBLIC_ORIGIN`·`PALM_SESSION_SECRET`에 묶여 있다. 셋 중 하나라도 바꾸면 무효가 되므로 probe를 다시 실행해야 한다.
3. **다른 네트워크에서 한 번 더**: 예를 들어 휴대폰 LTE와 사무실망처럼 서로 다른 두 네트워크에서 probe를 실행한다. 응답의 `ipFingerprint`가 서로 달라야 한다.
   - 둘이 같다면 모든 사용자가 한 IP로 보이는 구성(앞단 proxy·CDN)이다. 이 경우 IP 한도가 무의미하므로 공개하지 않는다.
   - 원본 IP는 응답·로그에 나오지 않는다.
4. **우회 경로 없음 확인**: 공개 도메인과 배포 URL(`*.vercel.app`) 모두에서 probe가 established인지 확인한다. Vercel 외의 다른 origin이나 proxy에서 같은 앱을 서비스하지 않는다.
5. **다른 배포 형태(Vercel 외, 또는 Vercel 앞단의 별도 proxy/CDN)**: 지원하지 않는다. 새 전략 추가는 별도 설계·검수 대상이다.

## 2. Kill switch

- 전체 provider 중단: `PALM_EXTRACTION_ENABLED=false`. operator 경로도 함께 멈춘다.
- 신뢰 ingress 무효화: `PALM_TRUSTED_INGRESS_VERIFICATION`을 비우면 공개 경로가 꺼진다.
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
