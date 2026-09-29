# Claude Implementation Report

Status: PHASE 2B FOUNDATION IMPLEMENTED — AWAITING REVIEW (Identity change not approved)

Phase 2B foundation (observational only). Branch `refactor/pattern-foundation-phase2b` (from main `5758350`). Not merged, not pushed. 이전 Phase 2A 보고는 git history(`5758350`)에 있다.

## Implemented Scope

사용자가 승인한 범위는 **사용자에게 보이지 않는 기반 작업** 두 가지다. Identity 선택은 변경하지 않았다.

1. **다양성 측정 기준선**: `scripts/diagnostic-identity-diversity.ts`
   - 결정적 LCG(seed 12345)로 합성 입력 20,000건을 만든다. `Math.random`은 쓰지 않는다.
   - 측정 항목:
     - archetype 분포, 상위 1개·상위 4개 점유율
     - Identity 선택 경로(쌍 / 단일·fallback)
     - 선택된 쌍이 대표 교집합 키워드(`commonKeywords[0]`)를 포함하는 비율과 포함하지 않는 비율
     - 중복 authored pair, 구조적으로 도달할 수 없는 archetype
   - 합성 균등 입력이며 **실제 사용자 분포 추정이 아님**을 파일 머리와 출력에 명시했다.
   - **품질 기준으로 실패하지 않는다.** 실패는 무결성 오류일 때만이다. 해당 오류는 다음과 같다.
     - `analyzeDestiny` 예외
     - 같은 입력을 두 번 실행했을 때의 digest 불일치(비결정성)
     - 어휘 밖의 태그, 같은 태그로 만든 쌍, 빈 archetype, archetype 이름 중복
2. **최소 패턴 파생**: `app/lib/analysisPatterns.ts`
   - `deriveAnalysisPatterns(trace, authoredPairs)`는 순수 함수다.
   - 결과는 `AnalysisPattern[]` = `ConvergencePattern | AuthoredPairPattern`이다.
   - 점수·가중치·신뢰도·순위·유사도가 없고, 다른 범주도 없다.
   - Snapshot에 저장하지 않으며, trace에서 언제든 다시 계산할 수 있다.
3. **읽기 전용 노출**: `app/lib/analysis.ts` +7줄
   - `IDENTITY_PAIR_DEFINITIONS`와 `IDENTITY_SINGLE_DEFINITIONS`를 `Readonly` 타입으로 export했다. 기존 `CONFLICT_IDENTITY`·`SINGLE_IDENTITY`와 같은 참조다.
   - 선택 로직(`generateIdentity`)과 목록 내용·순서는 그대로다.

### Pattern 판정 방식

- **convergence**
  - 한 CoreTag를 **서로 다른 source 2개 이상**이 지지하면 성립한다. 기록 필드는 `sources`, `evidenceIds`(중복 없음), `claimIds`다.
  - source는 Claim의 Evidence에서 읽는다. 따라서 다음 경우는 모두 source 1개로 센다.
    - zodiac 경로와 태양궁 placement: 같은 Evidence
    - 태양·달·상승궁: 같은 `western-astrology` source
    - 사주 지배·보완 경로: 같은 `saju` source
  - 이는 현재 교집합(`calcCommonKeywords`)이 서양 점성술을 1세트로 세는 방식과 같다. 회귀 검사로 확인했다. 비fallback 교집합 키워드 = 지지 source가 가장 많은 convergence trait다.
  - 범위: 사주·MBTI·혈액형·zodiac·태양/달/상승 Claim. **타로는 제외**한다. 타로는 merged coreTags·교집합·Identity에 참여하지 않는다.
- **authored-pair**
  - 기존 `IDENTITY_PAIR_DEFINITIONS`의 각 쌍에 대해, 두 태그가 모두 지지되면 성립한다.
  - 기록 필드:
    - `pairIndex`, `ruleId: 'identity.conflict-pair@1'`
    - 양쪽의 `claimIds`·`sources`
    - `sharedSources`: 두 태그를 모두 지지하는 source. 비어 있으면 서로 다른 source 간 공존이다.
  - 범위는 `generateIdentity()`의 합집합과 같다(사주·zodiac·혈액형·MBTI). 달·상승궁·타로는 제외한다.
  - 중복 쌍(#8 = #3)은 고치지 않고 별도 항목으로 둔다.
  - 회귀 검사로 확인했다: 첫 authored-pair의 archetype = 실제 Identity.
- **공통 규칙:** available Evidence가 없는 Claim은 근거로 쓰지 않는다. 사주 보완 경로 태그는 의미 판단 없이 그대로 기록한다(재가중·제거 없음).

## Files Changed

| 파일 | 변경 |
| --- | --- |
| `app/lib/analysisPatterns.ts` | 신규 — 타입 + 순수 파생 함수 |
| `app/lib/analysis.ts` | Identity 정의의 읽기 전용 export 2개 (+7줄) |
| `scripts/regression-analysis-patterns.ts` | 신규 — 패턴 회귀 검사 |
| `scripts/diagnostic-identity-diversity.ts` | 신규 — 다양성 기준선 진단 |
| `docs/ai/CLAUDE_REPORT.md`, `docs/ai/CURRENT_PHASE.md` | 보고·상태 |

별도 커밋 `e8737a6`에 Phase 2B 예비 분석 문서(`CODEX_REVIEW.md` 앞부분)를 보존했다. Phase 2A 기록은 그 아래에 그대로 있다.

변경하지 않은 것:
- `generateIdentity`, Identity 정의·순서, 중복 쌍, 도달 불가 archetype
- CoreTag 어휘·매핑, 사주 보완 의미, 교집합, conflictEngine, keywordStrengths
- 서술 템플릿, Destiny Code, UI, 저장·legacy 의미, `ANALYSIS_ENGINE_VERSION`, golden baseline

## Validation

- **다양성 기준선** (digest `5de12fdd`, 20,000건):

  | 항목 | 값 |
  | --- | --- |
  | 정의된 archetype / 관측된 archetype | 21 / 12 |
  | 상위 1개 (외로운 연결주의자) | 47.6% |
  | 상위 4개 | 91.6% |
  | 쌍 경로 / 단일·fallback 경로 | 99.5% / 0.5% |
  | 선택된 쌍이 `commonKeywords[0]` 포함 | 15.4% |
  | 선택된 쌍이 `commonKeywords[0]` 미포함 | 84.6% |
  | 중복 쌍 | #8(창의적+체계적) = #3 |
  | 구조적 도달 불가 | 안전한 탐험가 |

- **패턴 회귀** (`PASS: all analysis-pattern regression checks`, 개별 assertion 71개):
  - fixture:
    - 서로 다른 source → convergence, 단일 source → 없음
    - 사주 두 경로 → 없음, zodiac+태양(공유 Evidence) → 없음, 태양+달 → 없음
    - zodiac+태양+사주 → source 2 / Evidence 2 / Claim 3
    - 타로 불참, missing Evidence로 근거가 만들어지지 않음
    - 양쪽 provenance, 같은 source 공존과 다른 source 간 공존의 구분
    - 달·타로는 Identity 범위 밖, 중복 쌍 보존
  - 실제 분석 8건:
    - 결정성, trace 불변, Snapshot 불변(`patterns` 필드 없음)
    - convergence source의 유효성, 교집합 키워드와의 일치
    - 첫 authored-pair = 실제 archetype
    - 실제 데이터에 같은 source 공존과 다른 source 간 공존이 모두 존재
- **Mutation check:** convergence 판정 기준을 source 수에서 Claim 수로 일시 변경하자, 이중 계산 검사 3개와 실제 사례 검사들이 FAIL했다. 복구 후 전체 PASS.

## Build / Test / Lint

```
npx -y tsx scripts/golden-analysis.ts                # PASS: 7 golden cases match baseline
npx -y tsx scripts/regression-saved-context.ts       # PASS
npx -y tsx scripts/regression-evidence-trace.ts      # PASS
npx -y tsx scripts/regression-analysis-patterns.ts   # PASS (71)
npx -y tsx scripts/diagnostic-identity-diversity.ts  # OK (무결성 오류 0)
npx tsc --noEmit -p .                                # OK
npm run build                                        # OK
npm run lint                                         # 기존 9건과 동일 (신규 0)
git diff --check                                     # OK
```

## Deviations From Design

예비 분석(`CODEX_REVIEW.md` 5절) 대비 세부 결정:

1. **필드 이름:** `authored-pair`의 `crossSource: boolean` 대신 `sharedSources: string[]`을 썼다. 어떤 source 안에서 공존하는지까지 보여 주기 위해서다. 비어 있으면 서로 다른 source 간 공존이다.
2. **추가 필드:** `pairIndex`를 두었다. 중복 쌍을 고치지 않고 구분하기 위해서다.
3. **두 패턴의 범위 차이:** convergence는 교집합 범위(달·상승궁 포함), authored-pair는 Identity 범위(태양만)를 쓴다. 현재 엔진의 두 단계가 실제로 다른 범위를 쓰기 때문이며, 이를 코드 상수로 명시했다.
4. **읽기 전용 export:** Identity 정의를 export했다. 패턴 파생과 진단이 목록을 복제하지 않도록 하기 위해서다.

## Remaining Issues

- 다양성 진단은 현재 편향을 **기록만** 한다. 상위 집중, 교집합과 Identity의 분리, 중복 쌍, 도달 불가 archetype은 그대로 남아 있다. 모두 향후 승인 사항이다.
- 패턴은 아직 어떤 소비자도 쓰지 않는다. Identity 개선에 쓰려면 규칙 승인, `ANALYSIS_ENGINE_VERSION` 증가, golden 명시적 재설정이 필요하다.
- 진단 실행에 약 11초가 걸린다(20,000건 × 2회 결정성 확인). 빠른 회귀 목록과는 분리해서 운용하는 것이 좋다.

## Final Status

PHASE 2B FOUNDATION IMPLEMENTED — IDENTITY CHANGE NOT APPROVED
