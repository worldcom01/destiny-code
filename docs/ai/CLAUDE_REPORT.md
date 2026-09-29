# Claude Implementation Report

Status: IMPLEMENTED — AWAITING CODEX REVIEW

Phase 2A — Evidence Traceability. Branch `refactor/evidence-trace-phase2a` (from main `81b0c90`). Not merged, not pushed.

## Implemented Scope

`CODEX_REVIEW.md` 3단계 계획 그대로 구현했다.

1. **순수 trace 모듈** `app/lib/evidenceTrace.ts`
   - `EvidenceRecord`, `InterpretationClaim`, `AnalysisTrace`(version 1) 타입은 명세와 동일한 필드다.
   - `buildAnalysisTrace(input)`와 소스별 함수: `traceSaju`, `traceMbti`, `traceBloodType`, `traceWesternAstrology`, `traceTarot`.
   - 기존 계산을 다시 실행하지 않는다. 난수·시간·I/O가 없다. 입력을 변경하지 않는다. 분석 타입은 `import type`만 사용한다.
2. **Snapshot 연결** `app/lib/analysis.ts` (+11줄)
   - `AnalysisSnapshot`에 `trace?: AnalysisTrace`를 추가했다.
   - `analyzeDestiny()`에서 conflicts·keywordStrengths·coreTags 계산 뒤, return 직전에 `buildAnalysisTrace()`를 한 번 호출한다. `ELEMENT_CORE_TAGS`는 복제하지 않고 참조로 전달한다.
   - 다른 결과는 trace를 읽지 않는다. `schemaVersion: 2`와 `ANALYSIS_ENGINE_VERSION`은 유지했다.
3. **집중 회귀** `scripts/regression-evidence-trace.ts`
   - 수용 기준 3–10을 218개 assertion으로 검사한다.

소스별 규칙은 명세를 따른다.
- **Saju:** 지배 오행 경로, 첫 부족 오행 경로. 최종 `saju.coreTags`에 남은 태그만 Claim으로 기록한다. 시간 맥락 Evidence는 Claim에 연결하지 않는다.
- **MBTI:** `type-mapping`. 미입력이면 missing이고 Claim이 없다.
- **Blood type, Tarot:** `symbolic`.
- **Western astrology:** 태양궁 Evidence를 `zodiac` 경로와 placement 경로가 공유한다. 달·상승궁이 없으면 missing이다. `is-approximate`는 원래 값 그대로 기록한다.

## Files Changed

| 파일 | 변경 |
| --- | --- |
| `app/lib/evidenceTrace.ts` | 신규 — 타입 + 순수 builder |
| `app/lib/analysis.ts` | import, `trace?` 필드, builder 호출 1곳 |
| `scripts/regression-evidence-trace.ts` | 신규 — Phase 2A 회귀 검사 |
| `docs/ai/CLAUDE_REPORT.md`, `docs/ai/CURRENT_PHASE.md` | 보고·상태 갱신 |
| `docs/ai/CODEX_REVIEW.md` | Claude가 수정하지 않음. 커밋되지 않았던 Codex 명세·C 판정을 그대로 포함해 커밋한다 |

변경하지 않은 파일: UI(`page.tsx`), `activeAnalysis.ts`, `storageEngine.ts`, `westernAstrology.ts`, `conflictEngine.ts`, `keywordEngine.ts`, `destinyCode.ts`, 궁합·프로필·analytics, 기존 테스트 스크립트, `golden-baseline.json`.

## Validation

- **Golden:** `PASS: 7 golden cases match baseline`. baseline은 재생성하지 않았다.
- **Saved-context:** `PASS: all saved-context regression checks`. 기존 스크립트를 수정하지 않았다.
- **Evidence-trace:** `PASS: all evidence-trace regression checks` (개별 assertion 218개 PASS + 최종 요약 PASS 1줄). 검사 내용:
  - 7개 golden 입력에서 다음을 확인한다.
    - ID 유일성, Claim이 참조하는 Evidence의 존재·available 상태
    - target별 trait를 중복 제거한 결과가 기존 태그와 일치
    - placement Claim의 합집합이 `westernAstrology.coreTags`와 일치
    - Evidence 값이 실제 소스 값과 일치, ruleId·basis, 소스 순서
    - 달·상승궁·MBTI 누락 처리
    - merged coreTags에 타로 미참여
  - 사주 fixture: 두 경로의 중복 태그, 3개 제한으로 빠진 태그의 미기록, 부족 오행 없음, 시간 미입력.
  - zodiac/태양궁 키가 다를 때 별도 Evidence로 기록되는지(fixture).
  - builder의 결정성, 입력 불변, `Math.random`·`Date.now` 미사용.
  - 카드 없는 경로의 `Math.random` 호출 수가 기존과 같은지(2회), 카드 있는 경로는 1회인지.
  - trace가 든 Snapshot의 저장·조회 깊은 동등성, 재저장 시 원본 보존.
  - trace 없는 v2와 실제 legacy 형태 fixture를 따로 만들어 조회·재저장·삭제 후 재저장 시 trace가 소급되지 않고 형식(kind)이 유지되는지.
- **Mutation check:** 사주 보완 경로의 3개 제한 필터를 일시적으로 제거하자 해당 5개 케이스가 FAIL했다. 복구 후에는 전체 PASS다.
- **크기:** trace JSON은 최대 5,773자로 Snapshot의 약 44%다. 저장 10건은 176,695 bytes다. trace에는 생년월일·좌표·서술 문장이 들어가지 않는다.

## Build / Test / Lint

```
npx -y tsx scripts/golden-analysis.ts            # PASS
npx -y tsx scripts/regression-saved-context.ts   # PASS
npx -y tsx scripts/regression-evidence-trace.ts  # PASS
npx tsc --noEmit -p .                            # OK
npm run build                                    # OK
npm run lint                                     # 기존 9건과 동일 (신규 0)
git diff --check                                 # OK
```

## Deviations From Codex Design

명세의 방향은 바꾸지 않았다. 명세가 정하지 않은 세부만 다음처럼 정했다.

1. **zodiac 경로의 Claim ID:** `zodiac:sun-sign:<tag>`로 정했다. zodiac과 태양궁 placement가 같은 Evidence(`western-astrology:sun-sign`)를 공유하므로, 명세 예시 형식(`<evidenceId>:<tag>`)을 그대로 쓰면 ID가 충돌한다. 나머지 Claim은 `<evidenceId>:<tag>`다.
2. **zodiac/태양궁 키 불일치:** 명세는 "조용히 합치지 말고 보고"라고 했다. builder는 두 키가 다르면 별도 Evidence `western-astrology:zodiac-sign`에 연결한다. 현재 코드에서는 두 키가 항상 같으며, 회귀 검사가 이를 확인한다.
3. **같은 경로 안의 중복 태그:** Claim ID 충돌을 막기 위해 같은 경로 안에서는 한 번만 기록한다. 현재 매핑 테이블에는 해당 사례가 없다.
4. **`ZodiacKey` 타입:** `westernAstrology.ts`에서 import했다. analysis.ts의 같은 이름 타입은 export되지 않는다.

## Remaining Issues

- **trace 크기:** Snapshot의 약 44%로, 작지 않다. `ruleId`·`target` 문자열이 Claim마다 반복되기 때문이다. localStorage 한도 안이라 차단 사유는 아니다. 줄이려면 형식을 바꿔야 하므로 이번 범위에서 제외했다.
- **기존 saved-context 검사 fixture:** Case C의 legacy fixture는 새 Snapshot에서 필드를 지우는 방식이어서, 이제 `trace` 키가 남는다. 이 검사는 여전히 통과하고 검사 의도에도 영향이 없다. "기존 테스트 수정 금지"에 따라 그대로 두었다. 실제 legacy 형태 검사는 새 스크립트의 9번 항목이 담당한다.
- **trace 사용처:** 아직 UI·공유·analytics 어디에서도 trace를 사용하지 않는다. 명세대로다.

## Final Status

IMPLEMENTED — AWAITING CODEX REVIEW
