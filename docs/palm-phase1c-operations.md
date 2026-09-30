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
   - `PALM_TRUSTED_IP_HEADER`: 배포 proxy가 직접 설정하는 단일 IP 헤더. 쉼표 목록이면 요청을 거부한다.
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. **로그/APM**: 요청 body와 헤더 capture를 끈다. cookie, `x-palm-csrf`, IP, 이미지가 로그에 남지 않게 한다. 앱 코드는 정규화된 오류 code만 남긴다.
5. **실기기 확인**: mock이나 공개 OFF 상태에서 다음을 먼저 확인한다.
   - iPhone 카메라·갤러리, HEIC 안내, 큰 사진
   - Android JPEG/WebP
   - 취소·실패·재시도, 저장 후 다시 열기, A/B 결과 격리, 공유, 429·비활성 안내

## 2. Kill switch

- 전체 provider 중단: `PALM_EXTRACTION_ENABLED=false`. operator 경로도 함께 멈춘다.
- 공개 경로만 중단: `PALM_PUBLIC_ENABLED=false`.
- 끄면 결과 화면에 새 분석 입력이 나타나지 않는다. 이미 저장된 손바닥 결과는 기기에서 계속 표시되고, 기본 운명 코드 결과는 영향이 없다.
- DB·설정 장애가 나면 공개 호출은 provider 호출 0회로 503을 반환한다(fail closed).

## 3. 비용 통제의 의미와 한계

- 한도는 운영 상한이며 통계적 근거가 있는 값이 아니다. 세션·IP·전체 한도, 동시성, 같은 요청 ID·같은 이미지 중복을 공유 DB의 atomic 예약으로 막는다.
- 익명 세션은 계정 인증이 아니다. 세션 재발급·IP 분산을 완전히 막지는 못하며, 전체 일 한도가 마지막 안전장치다.
- 예약한 호출은 timeout·응답 유실이 나도 환불하지 않는다(`uncertain`). 자동으로 다시 호출하지도 않는다. exactly-once 처리는 보장하지 않는다.
- 같은 NAT를 쓰는 사용자들은 IP 한도를 공유할 수 있다.
- `store:false`는 OpenAI 측 보관이 0이라는 뜻이 아니다. 안내 문구도 그렇게 약속하지 않는다.

## 4. 저장 원칙

- 원본 사진은 서버·DB·로그·analytics 어디에도 저장하지 않는다.
- 사용자가 저장하면 검증된 관찰·결정적 해석·비교만 기기의 `destiny_palm_supplements_v1`에 저장한다.
- 개선용 사진 수집이나 동의 UI는 없다(`improvementRetentionEnabled=false`). 보관·삭제·철회 정책이 준비된 뒤 별도로 설계한다.
