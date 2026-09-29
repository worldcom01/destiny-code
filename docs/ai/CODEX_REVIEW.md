# Phase 2B foundation — Codex 최종 독립 검수

상태: **수정 후 재검수 필요**. 아래 Phase 2B 예비 분석 및 Phase 2A 기록은 당시 이력으로 그대로 보존한다. 현재 판정은 이 절을 따른다.

## 최종 판정

**C. Revision required**

대상: `refactor/pattern-foundation-phase2b`, `38834e8`. 비교: `main` `5758350`부터 `main...38834e8`. 예비 문서 커밋 `e8737a6` 포함. 검수 시작 시 working tree는 clean이었다. 애플리케이션·테스트·golden을 수정하지 않았으며 병합·push하지 않았다.

문제 수: **BLOCKER 0 / IMPORTANT 1 / MINOR 1**. 패턴 파생과 현재 사용자 출력은 보존되지만, 향후 비교 기준으로 사용할 입력 생성기의 짧은 반복을 수정해야 한다. 아래 OBSERVATION은 병합 전 필수 수정 요구가 아니다.

## IMPORTANT 1 — 진단 입력 20,000건 중 고유 입력은 1,409건뿐

위치: `scripts/diagnostic-identity-diversity.ts:39–42`.

LCG의 `s * 1103515245`를 JavaScript Number 일반 곱셈으로 수행한다. 이 곱은 정수 안전 범위를 넘으므로 하위 비트 정밀도를 잃고 의도한 정수 LCG와 다른 짧은 상태 순환을 만든다. 결정적이라는 사실만으로 균등한 합성 표본이 되는 것은 아니다.

독립 확인은 원본 generator를 메모리에서 그대로 읽고 각 전체 입력(날짜·시간·MBTI·성별·혈액형·카드·위치·달력)을 JSON으로 비교했다. 소스 파일을 수정하지 않았다.

- 실행 입력: 20,000행
- 서로 다른 전체 입력: **1,409행**
- 반복 행: **18,591행(92.955%)**
- 첫 반복 발생: 0-based index **1,409**
- 동일 입력 최대 출현: **23회**
- LCG 상태 자체의 반복: 시작 5,938번째 상태 이후 주기 10,466

따라서 보고 수치는 현재 반복 스트림에 대한 산술 결과로는 재현되지만, '20,000개 균등 생성 입력'을 넓게 관측한 결과로 사용할 수 없다. 나쁜 다양성 때문에 실패해야 한다는 뜻이 아니라 **입력 생성 무결성** 문제다. 실제 사용자 분포가 아니라는 안내만으로 이 문제는 해소되지 않는다.

필수 수정:

1. 정수 연산이 명확하고 충분한 주기를 갖는 결정적 생성기로 교체한다. 예를 들어 적절한 32-bit 연산을 사용하는 방식으로 처리하고 출력은 `[0, 1)`로 제한한다. 전역 Math.random은 사용하지 않는다.
2. 전체 입력 fingerprint의 고유 개수·중복 개수를 출력하고, 고정 seed/건수에서 현재와 같은 짧은 반복을 탐지하는 집중 검사를 추가한다. Identity 비율이나 archetype 균등성을 성공 조건으로 만들지 않는다.
3. 수정된 입력 스트림으로 진단 수치와 digest를 새로 기록한다. 이번 `5de12fdd`와 아래 수치는 이전 생성기의 결과라는 이력으로 보존하고, golden baseline은 변경하지 않는다.

## MINOR 1 — missing Evidence의 pair 검사가 해당 조건을 실제로 시험하지 않음

위치: `scripts/regression-analysis-patterns.ts:92–99`.

fixture의 두 Claim은 모두 `체계적`이며 pair는 `체계적 + 감성적`이다. `감성적` Claim이 처음부터 없으므로, missing Evidence를 잘못 허용해도 pair가 생성되지 않아 assertion이 통과한다. 현재 공통 supported 필터의 구현 자체는 올바르며 convergence fixture는 같은 필터를 시험하지만, pair 전용 검사의 이름과 증명 범위는 일치하지 않는다.

필수 수정: pair 양쪽 태그의 Claim을 실제로 제공하고 한쪽 Evidence만 missing으로 둔다. missing일 때 pair 없음, 같은 Evidence를 available로 바꾸면 pair 있음이라는 대조를 확인한다. 프레임워크나 알고리즘 변경은 필요 없다.

## 진단 수치 독립 재현과 해석

표준 진단을 실행하고 별도 집계로 확인했다.

| 항목 | 재현 결과 |
| --- | --- |
| 정의 / 관측 archetype | 21 / 12 |
| 상위 Identity | 외로운 연결주의자 9,526 / 20,000 = 47.63% |
| 상위 4개 | 18,328 / 20,000 = 91.64% |
| authored-pair 선택 | 19,907건 |
| 단일/fallback 선택 | 93건 |
| 대표 교집합 키워드 미포함 | 16,844 / 19,907 = 약 84.6% |
| 중복 authored pair | 0-based #8 = #3, 창의적 + 체계적 |
| 중복으로 구조적 도달 불가 | 안전한 탐험가 |
| digest | 5de12fdd |

84.6%의 분모는 전체 20,000건이 아니라 **pair 선택 건수**다. commonKeywords 전체와의 불일치가 아니라 첫 키워드의 포함 여부다. top1·top4·중복 쌍 계산은 정확하다. 도달 불가 탐지는 앞선 동일 태그 집합에 가려진 쌍을 증명하며, 모든 다른 archetype의 도달 가능성을 증명하는 도구는 아니다. 표본 미관측과 구조적 도달 불가를 구분해 출력한다.

digest는 순서 있는 archetype와 commonKeywords 목록을 해시한다. ID·시각을 제외하므로 비교 재현성에는 적절하지만 전체 Narrative나 trace의 동일성을 보장하지 않는다. 진단 소스에는 Math.random 호출이 없으나 analyzeDestiny 내부의 기존 analysisId 난수는 실행된다. 그 값은 측정과 digest에 참여하지 않는다. 품질 임계값으로 실패시키는 로직은 없다.

## convergence 의미 검수 — 현재 소스 단위 정의에 적합

`AnalysisPattern`은 convergence와 authored-pair 두 종류만 포함한다. 점수·가중치·confidence·확률·의미 유사도·새 관계 분류가 없다. 단순 순수 함수와 출처 배열로 현재 목적에 충분하다.

convergence는 available Evidence를 가진 Claim을 target 범위로 제한하고, Evidence의 source 문자열을 중복 제거하여 최소 2개일 때 생성한다.

- zodiac/Sun은 동일 Evidence와 동일 source로 1개다.
- Sun/Moon/Ascendant는 Evidence가 달라도 western-astrology source 1개다.
- 사주 지배/보완 경로도 source 1개다.
- 같은 Evidence를 여러 Claim이 참조해도 source 수는 늘지 않는다.
- Tarot target은 제외된다.

이는 현재 calcCommonKeywords의 western 합집합·MBTI·사주·혈액형 네 소스 단위와 맞는다. 예비 문서의 'Evidence 수로 세어야 한다'는 설명은 이 구현 기준으로 보완한다. Evidence ID dedupe만으로는 placement와 사주 내부 경로를 접을 수 없으므로 **source dedupe가 필요**하다.

다만 이는 서로 다른 해석 체계라는 뜻이지 통계적 독립성이나 검증된 행동 증거라는 뜻은 아니다. 현재 zodiac/Sun 테이블이 같으므로 중복 경로를 포함해도 태그 지지 범위는 같다. 미래에 두 테이블이 달라지면 convergence와 calcCommonKeywords 일치를 다시 검토해야 한다.

## authored-pair 출처와 Identity 불변식

Identity target 범위는 saju·zodiac·bloodType·MBTI로 정확하다. Moon·Ascendant·Tarot와 Sun placement의 별도 경로는 제외한다. 양쪽 claimIds·sources와 sharedSources를 보존하며 pairIndex로 중복 쌍도 별개로 남긴다. 기존 목록 순서대로 생성한다.

동일한 20,000행을 별도로 실행해 실제 Identity와 첫 authored-pair를 비교했다. pair가 존재한 19,907행의 불일치는 **0건**이었다. 93행은 pair가 없고 기존 single/fallback으로 선택되므로 '항상 첫 pattern이 Identity다'라는 무조건적 표현은 틀리다. 정확한 조건은 **현재 엔진이 생성한 정상 trace와 동일 정의 목록을 사용하고, authored-pair가 존재할 때**다. 누락·수정된 trace나 사용자 지정 pair 목록에 이 불변식을 적용하지 않는다.

sharedSources가 비면 두 태그의 source 집합이 분리되어 있다. 비어 있지 않으면 한 source 안의 공존이 존재한다. 하지만 비어 있지 않아도 다른 source 간 지원이 동시에 있을 수 있다. 예: A는 MBTI, B는 MBTI+사주. 따라서 같은 source/다른 source를 상호 배타적인 제품 분류로 해석하면 안 된다. 현재 양쪽 sources가 남아 있으므로 데이터 손실은 없다.

## OBSERVATION — 읽기 전용 export의 경계

`analysis.ts:640–644`는 원본 배열·객체를 TypeScript readonly 타입으로 공개한다. 정의 내용·순서·선택 함수는 변경되지 않았고 현재 소비자는 읽기만 한다. 런타임 import 순환도 없다.

Object.freeze는 아니며 원본과 같은 참조다. 독립 확인에서 배열·항목·tags 모두 런타임 frozen이 아니었다. 따라서 '어떤 런타임 소비자도 수정할 수 없다'고 보장할 수는 없다. 현재 정상적인 타입 검사 경로에서 수정은 막히고 실제 수정 소비자는 없어 이번 병합의 추가 필수 조건으로 삼지 않는다.

## 기존 동작·범위 보존

analysis.ts의 유일한 변경은 읽기 전용 정의 export 7줄이다. generateIdentity, 매핑, 목록, 버전은 그대로다. analysisPatterns는 애플리케이션 계산이나 UI에서 호출되지 않으며 스크립트에서만 사용된다. Snapshot에 patterns 필드가 추가되지 않았고 저장·legacy/v2·backfill 경로도 변경되지 않았다. CoreTag, keywordStrengths, conflicts, Identity, Narrative, UI, 공유, analytics, 궁합은 기존 경로를 유지한다.

golden baseline의 main/HEAD git blob은 모두 `d79d1fa2a61558a741e640e02ce385a6f24d2958`로 동일하다. 재생성하지 않았다.

## 독립 실행 검증

| 검증 | 결과 |
| --- | --- |
| golden regression | 7개 사례 통과 |
| saved-context regression | 전체 통과 |
| evidence-trace regression | 전체 통과 |
| pattern regression | 71개 개별 assertion 통과, MINOR 1의 한계 존재 |
| diversity diagnostic | 실행 성공, 5de12fdd 재현; IMPORTANT 1 발견 |
| TypeScript --noEmit --incremental false | 통과 |
| npm run build | 통과 |
| git diff --check main...HEAD | 통과 |

npm/Google Fonts는 앞선 제한 환경 실패를 근거로 승인된 네트워크 접근에서 표준 명령을 실행했다. 기존 golden을 수정하지 않았다. 추가 고유 입력·LCG 주기·pair 불변식 검사는 메모리에서 수행했다. 통과 결과만으로 진단의 표본 품질을 승인하지 않는다.

## Identity 재설계 진입 판단과 다음 단계

출처별 수렴·pair 지원을 비교할 기술적 데이터는 갖춰졌다. 다만 **다양성 입력 생성기 수정과 기준선 재측정 후** 별도 승인된 Identity 선택 설계로 진행하는 것이 적절하다. 이번 기반에는 실제 긴장/충돌을 검증하는 새 근거가 없으며 authored-pair는 사람이 작성한 태그 공존 규칙이다. 이를 곧바로 경험적으로 검증된 긴장으로 승격하지 않는다.

필수 작업은 IMPORTANT 1의 생성기·무결성 검사·기준선 보고 수정과 MINOR 1의 대조 fixture 보강뿐이다. 애플리케이션 Identity 변경·비율 인위적 균등화·golden 재생성은 요구하지 않는다. Claude 수정 후 Codex 재검수하며 현재 병합하지 않는다.

---

# Phase 2B Preliminary Architecture Analysis — Claude Code

상태: **예비 설계 검토 (PRELIMINARY)** — 승인되지 않음, 구현 준비 아님

작성: Claude Code (Codex 일시 부재로 대행). 기준: `main` `5758350`, working tree clean. 이 절은 분석만 담는다. 애플리케이션 코드·테스트·baseline은 변경하지 않았다. Codex의 독립 검토로 대체·보완되어야 한다.

근거 표기: 코드 위치는 `app/lib/analysis.ts` 기준 행 번호. 수치는 저장소 밖 임시 스크립트로 `analyzeDestiny()`를 20,000개 입력에 실행해 측정했다.

- **측정 입력:**
  - 생년월일: 1950–2009년, 일자 1–28일
  - 시간: 70%만 입력, 30분 단위
  - 출생지: 시간이 있으면 80%(서울 좌표)
  - MBTI: 85%만 입력(16유형 균등)
  - 혈액형: 4종 균등
  - 타로·성별: 무작위
- **재현성과 대표성:** 입력은 고정 seed LCG로 생성했다. 분석 로직은 수정하지 않았다. 실제 사용자 분포가 아닌 균등 표본이므로, **절대 비율이 아니라 구조적 편향의 근거**로만 사용한다.

## 1. 실제 파이프라인

```text
소스 계산
  saju.coreTags        = dedupe(ELEMENT_CORE_TAGS[dominant] + ELEMENT_CORE_TAGS[missing[0] ?? dominant]).slice(0,3)   (L321–324)
  zodiac.coreTags      = ZODIAC_DATA[태양궁] 3개                                                                        (L179–192)
  westernAstrology.coreTags = dedupe(태양 + 달 + 상승궁 태그)  — 최대 9개                                                (westernAstrology.ts L369)
  mbtiTraits.coreTags  = MBTI_DATA 3개 (미입력이면 [])
  bloodType.coreTags   = BLOOD_TYPE_DATA 3개
  tarot.coreTags       = TAROT_DATA 3개
        │
        ├─ commonKeywords  = calcCommonKeywords([western, mbti, saju, blood])                 (L353, L799)
        ├─ detailedReading = generateDetailedReading(saju, zodiac, mbti, blood, tarot, commonKeywords)
        ├─ identity/archetype = generateIdentity(saju, zodiac, mbti, blood, tarot, commonKeywords)
        ├─ tarotFlow       = generateTarotFlow(tarot, commonKeywords, saju)
        ├─ conflicts       = detectConflicts(...)          (conflictEngine.ts — 표시 전용)
        ├─ keywordStrengths = computeKeywordStrengths(...) (keywordEngine.ts — 표시 전용)
        ├─ coreTags (merged) = dedupe(saju + western + mbti + blood)  (프로필·궁합용)
        └─ trace (Phase 2A)  = 위 태그들의 출처 기록 (아무것도 구동하지 않음)
```

**단계별로 쓰는 태그 집합이 서로 다르다 (CONFIRMED).**

| 단계 | 사용하는 소스 | 서양 점성술 표현 | 타로 |
| --- | --- | --- | --- |
| commonKeywords(교집합) | western, MBTI, 사주, 혈액형 | `westernAstrology.coreTags`(태양+달+상승 합집합, 1세트) | 제외 |
| Identity | 사주, zodiac, 혈액형, MBTI | `zodiac.coreTags`(태양만) | 제외 (인자로 받지만 미사용) |
| 상세 해석 allTags | 사주, zodiac, 혈액형, MBTI, 타로 | 태양만 | 포함 |
| keywordStrengths | 사주, 태양궁, MBTI, 혈액형, 달궁, 상승궁 | 3개 placement를 각각 1세트 | 제외 |
| merged coreTags | 사주, western, MBTI, 혈액형 | 합집합 | 제외 |

같은 사용자의 "교집합", "정체성", "강도"가 서로 다른 소스 집합과 서로 다른 가중치로 계산된다.

## 2. 분석 질문별 결과

### Q1. 동일 CoreTag 반복 처리

- `calcCommonKeywords`는 소스 세트별로 `new Set`을 적용한 뒤, 태그가 몇 개 세트에 나타나는지 센다(L358–363). 같은 소스 안의 반복은 1로 접힌다.
- 서양 점성술은 태양·달·상승궁이 먼저 합집합(1세트)으로 접힌다. 그래서 세 placement가 모두 같은 태그를 가져도 1표다. **CONFIRMED.**
- Identity와 상세 해석은 전 소스 합집합(`new Set`)만 사용한다. 몇 개 소스가 지지하는지는 버려진다. **CONFIRMED.**
- 반대로 keywordStrengths는 placement를 따로 세므로, 같은 태양궁·달궁 태그가 2표가 될 수 있다. 단계마다 처리 방식이 다르다. **CONFIRMED.**

### Q2. 관련 있지만 다른 특성의 인식

- 오직 CoreTag 문자열 동등성만 사용한다. 태그 간 유사·관련 관계를 나타내는 데이터 구조가 없다. **CONFIRMED.**
- 유일한 "관계"는 사람이 작성한 쌍 목록이다. `CONFLICT_IDENTITY`(10쌍, L613), 상세 해석의 `conflictMap`(9쌍, L425), 궁합 엔진의 조건 목록이 있다. 모두 "두 태그가 모두 존재하는가" 검사다.

### Q3. 충돌/긴장 감지 방식

"충돌"이라는 이름의 서로 무관한 메커니즘이 세 개 있다. **CONFIRMED.**

1. **`conflictEngine.detectConflicts`:** 원천 속성 조건 규칙이다(MBTI 글자, zodiac 원소, 사주 지배·부족 오행, 혈액형×MBTI 그룹, 태양·달 원소). 최대 3개이며, 태그를 쓰지 않는다.
2. **`CONFLICT_IDENTITY`:** 합집합 안에 두 태그가 공존하면 "충돌"로 본다. Identity를 결정한다.
3. **상세 해석 `conflictMap`:** 2와 같은 방식이다(타로 포함 합집합). 첫 섹션에 문장 하나를 추가한다.

2와 3은 긴장이 아니라 **공존(co-presence)** 이다. 측정 결과 Identity 쌍이 한 소스 안에서 함께 나오는 경우는 5.2%, 서로 다른 소스에서 나오는 경우는 94.8%다. 이는 공존이 대부분 소스 간 합집합의 결과라는 뜻이다. 두 소스가 실제로 서로 반대되는 주장을 한다는 뜻은 아니다.

### Q4. 충돌이 Identity에 미치는 영향

- `conflictEngine` 결과는 Identity·상세 해석·Destiny Code 어디에도 쓰이지 않는다. snapshot에 저장되어 화면에 표시될 뿐이다. **CONFIRMED.**
- Identity를 결정하는 것은 태그 공존 목록(`CONFLICT_IDENTITY`)이다. 측정에서 99.8%가 이 경로로 결정된다.

### Q5. 소스별 실제 영향 범위

| 소스 | merged coreTags | 교집합 | Identity | 서술 |
| --- | --- | --- | --- | --- |
| 사주 | O | O | O | O (지배 오행 문장 다수 + fallback primaryTag) |
| 태양궁(zodiac) | — | (western 합집합의 일부로) O | O | O (원소별 관계 문장) |
| 달·상승궁 | O | O | **X** | X (상세 해석은 zodiac만 사용) |
| MBTI | O | O | O | O (I/F/J 글자 문장) |
| 혈액형 | O | O | O | O (혈액형별 관계 문장) |
| 타로 | X | X | X | O (allTags, tarotFlow, 교차 신호 출처 표기) |

달·상승궁은 교집합에는 영향을 주지만 Identity에는 영향을 주지 않는다. 측정 결과 `commonKeywords[0]`가 달·상승궁을 통해서만 서양 점성술 표를 얻는 경우가 21.5%다. **CONFIRMED.**

### Q6. 소스 순서의 영향 — 있음 (CONFIRMED)

- **`commonKeywords` 순서:** `tagCounts` Map의 삽입 순서(western → MBTI → 사주 → 혈액형 순의 최초 등장)를 따른다. `commonKeywords[0]`는 `primaryTag`, 상세 해석 첫 섹션, SINGLE_IDENTITY fallback, tarotFlow, Destiny Code seed를 결정한다. 따라서 동률일 때 **서양 점성술의 첫 태그(태양궁 테이블 순서)** 가 우선한다.
- **Identity:** `CONFLICT_IDENTITY.find`이므로 **목록 순서**가 결정한다.
- **상세 해석:** `allTags.find`는 사주 → zodiac → 혈액형 → MBTI → 타로 순이고, `conflictMap.find`는 목록 순서다.

### Q7. 영향력 불균형 — 있음

- **서양 점성술 합집합 (CONFIRMED):** 최대 9개 태그로, 10개 어휘 중 대부분을 덮는다(측정: full 데이터에서 6–8개가 일반적). 교집합 k를 세는 1세트이면서 다른 모든 세트와 겹칠 확률이 높다. 그래서 거의 항상 교집합에 "동의"하는 소스가 된다. 측정 결과 `commonKeywords[0]`의 95%가 서양 점성술 세트에 포함된다.
- **사주 보완 경로 (CONFIRMED):** 측정 결과 사주 태그의 약 25%가 **부족한 오행**의 태그(`missing-element-compensation`)에서만 온다(부족 오행이 있는 분석은 67%). 그런데 이것이 지배 오행 태그와 같은 무게의 "특성"으로 합쳐진다. 부족을 나타내는 태그가 보유 특성으로 취급되는 셈이다. 의도된 해석인지는 제품 결정이다.
- **시간 입력 여부 (PLAUSIBLE RISK):** 시간·출생지가 있으면 western 세트가 커져서 교집합 참여도가 올라간다. 입력 완성도가 성향 결과를 바꾸는 구조다.

### Q8. Identity/archetype 선택 방식 (L639–670)

1. `allTags = dedupe(사주 + zodiac + 혈액형 + (MBTI 4글자면) MBTI)`를 만든다. 측정 결과 크기 중앙값은 **7/10**이다. 타로와 달·상승궁은 제외된다.
2. `CONFLICT_IDENTITY`를 **순서대로** 보며, 두 태그가 모두 `allTags`에 있는 **첫 쌍**을 반환한다.
3. 없으면 `commonKeywords[0]`(또는 `saju.coreTags[0]`)로 `SINGLE_IDENTITY`를 조회한다.
4. 그것도 없으면 고정 문장을 쓴다.

교집합(`commonKeywords`)은 3단계에서만 쓰인다. 측정 결과 3단계 도달은 0.2%다. **선택된 Identity 쌍이 `commonKeywords[0]`를 포함하지 않는 경우는 84.7%다.** 즉 Identity는 사실상 교집합과 분리되어 있다. **CONFIRMED.**

### Q9. 서로 다른 입력이 같은 Identity로 수렴하는가 — 강하게 그렇다 (CONFIRMED)

측정 결과 archetype 분포는 다음과 같다(20,000개 입력).

| archetype | 비율 |
| --- | --- |
| 외로운 연결주의자 (1번 쌍 독립적+포용적) | 46.9% |
| 군중 속의 고독자 (2번 쌍) | 16.1% |
| 틀 안의 반항자 (4번 쌍) | 15.0% |
| 감정을 분석하는 사람 (3번 쌍) | 13.5% |
| 나머지 8종 | 8.5% |

- 상위 4종이 91.5%를 차지한다. 이론상 최대 21종(쌍 10 + 단일 10 + fallback)이지만, 관측된 것은 12종이다.
- `CONFLICT_IDENTITY`의 9번째 쌍 `['창의적','체계적']`은 4번째 쌍 `['체계적','창의적']`과 같은 집합이다. 따라서 **'안전한 탐험가'에는 도달할 수 없다(측정 0건).** 상세 해석 `conflictMap`에도 같은 중복이 있다.
- `archetype | commonKeywords[0]` 조합은 69종에 그친다.

### Q10. 서술 중 교집합 구조가 결정하는 비중

상세 해석 5개 섹션(L453–603)은 모두 **고정 문장 조회**다. 문장을 고르는 키는 다음과 같다.

| 섹션 | 조회 키 |
| --- | --- |
| 1 반복되는 내면 구조 | `commonKeywords` 앞 3개 라벨, `primaryTag`(= `commonKeywords[0]`), 첫 공존 쌍, 지배 오행 |
| 2 감정 처리 | 사주 태그 첫 일치, 사주+zodiac 첫 일치, 지배 오행, MBTI F/T, 수(水) 부재 |
| 3 관계 구조 | allTags 첫 일치 ×2, zodiac 원소, MBTI I/E, 혈액형 |
| 4 현재 흐름 | 지배 오행, 부족 오행 목록, MBTI J/P |
| 5 교차 신호 | `commonKeywords` 각각의 출처 나열 + 고정 결론 문장 |

- 교집합 구조가 직접 반영되는 것은 섹션 1의 첫 문장과 섹션 5다. 나머지는 **개별 소스 속성**(오행, 원소, MBTI 글자, 혈액형)으로 고른 고정 문장이다. 측정 결과 섹션 1 전체 문장의 조합은 687종이다.
- **섹션 5의 불일치 (CONFIRMED):** 교집합은 western 합집합으로 계산했지만, 출처 표기는 zodiac(태양)만 보고 타로를 포함한다. 그 결과 "독립적으로 반복 확인" 문장의 출처 목록이 실제 교집합 계산과 다를 수 있다.
- **원칙과의 충돌 (CONFIRMED, 코드 문구):** 섹션 5는 "서로 독립적인 체계들이 동시에 가리키는 교차점", "단순한 성격 유형이 아니라 반복적으로 활성화되는 내면 패턴임을 의미"라고 단정한다. 상징 체계의 일치를 검증처럼 표현하므로 AD-004 및 PROJECT_CONTEXT 원칙과 긴장 관계다. 문구 변경은 제품 결정이다.

## 3. 결과 유사성 원인 분류

| # | 원인 | 판정 | 근거 |
| --- | --- | --- | --- |
| R1 | Identity가 **고정 목록의 첫 공존 쌍**으로 결정됨 | **CONFIRMED (최대 원인)** | L653. 1번 쌍 하나가 46.9%, 상위 4쌍이 91.5% |
| R2 | Identity 합집합이 어휘 대부분을 덮음 (중앙값 7/10) | **CONFIRMED** | 쌍 존재 확률이 높아 목록 앞쪽 쌍이 거의 항상 성립 |
| R3 | 교집합·충돌(conflictEngine)이 Identity에 반영되지 않음 | **CONFIRMED** | 84.7%가 `commonKeywords[0]` 미포함, conflictEngine 미사용 |
| R4 | 작은 CoreTag 어휘 (10개)와 소스당 3개 태그 | **CONFIRMED (상한 요인)** | Identity 이론 최대 21종 |
| R5 | 중복 쌍으로 인한 도달 불가 archetype | **CONFIRMED** | '안전한 탐험가' 0건 |
| R6 | 조기 dedupe로 지지 소스 수·경로 소실 | **CONFIRMED** | Identity·서술은 합집합만 사용 |
| R7 | 첫 태그 우선 (`commonKeywords[0]`, `.find`) | **CONFIRMED** | 삽입·목록 순서 의존 |
| R8 | 서양 점성술 합집합의 과대 영향 | **CONFIRMED** | `commonKeywords[0]`의 95%가 western 포함 |
| R9 | 고정 템플릿 서술 | **CONFIRMED (부분)** | 섹션 2–4는 소스 속성 조회. 섹션 1 조합 687종으로 Identity보다는 다양 |
| R10 | top-N 절단 | **PLAUSIBLE RISK (작음)** | 사주 3개 제한, `kwLabel` 앞 3개, conflicts 3개, keywordStrengths 5개. Identity에는 영향 없음 |
| R11 | 서로 다른 소스 조합이 같은 merged 태그로 수렴 | **PLAUSIBLE RISK** | merged coreTags는 합집합이라 가능성 높음. 이번에 직접 측정하지 않음 |
| R12 | provenance 무시 | **CONFIRMED (Phase 2A 전까지)** | 2A trace는 기록만 하고 아직 아무것도 구동하지 않음 |
| R13 | 타로가 Identity를 바꿔 다양성을 줄임 | **NOT SUPPORTED** | 타로는 Identity에 불참(매개변수는 받지만 미사용) |
| R14 | 무작위성이 유사성의 원인 | **NOT SUPPORTED** | 타로 무작위 외 결정적. 타로는 Identity에 불참 |

## 4. Phase 2A trace로 새로 구분 가능한 것

trace는 **기록**이지 판단이 아니다. 아래는 "구분할 수 있게 되었다"는 뜻이며 "더 참이다"라는 뜻이 아니다.

1. **소스 간 수렴(cross-source convergence):** 같은 CoreTag를 지지하는 Claim의 **서로 다른 소스 수**를 셀 수 있다. 단, 태양궁은 `zodiac` 경로와 `sun` placement 경로가 같은 Evidence(`western-astrology:sun-sign`)를 공유한다. 수렴을 셀 때는 Claim 수가 아니라 **서로 다른 Evidence 수**로 세야 이중 계산을 피한다.
2. **소스 내부 공존과 소스 간 공존:** Identity 쌍이 한 소스(예: MBTI 하나) 안에서 함께 나온 것인지, 서로 다른 소스에서 나온 것인지 구분할 수 있다.
3. **사주 지배 경로와 보완 경로:** `saju.dominant-element-tags@1`과 `saju.missing-element-compensation@1`로, "보유 기운의 태그"와 "부족 기운의 태그"를 구분할 수 있다.
4. **입력 유형:** MBTI는 `type-mapping`(자기보고 유형의 매핑), 나머지는 `symbolic`으로 구분된다. 달·상승궁·MBTI의 **누락**을 명시적으로 알 수 있다.
5. **단계별 소스 범위 불일치의 진단:** 교집합(western 합집합)과 Identity(zodiac)가 다른 Evidence 집합을 쓴다는 것을 데이터로 보일 수 있다.

**구분해야 할 것:** 여러 상징 체계가 같은 태그로 매핑되었다는 것(수렴)은 **매핑 테이블들이 겹친다**는 사실이다. 그 사람의 성향이 경험적으로 확인되었다는 증거가 아니다. 특히 사주·별자리·혈액형·타로는 모두 `symbolic`이고, 매핑 테이블 자체가 같은 10개 어휘를 공유하도록 설계되어 있다. 따라서 수렴 수치를 신뢰도·정확도·"검증"으로 표현하거나 저장하지 않는다(AD-004).

## 5. Phase 2B 최소 추상화 평가

### 제안된 관계 범주 평가

| 범주 | 판정 | 이유 |
| --- | --- | --- |
| agreement (같은 태그, 여러 소스) | **채택 — `convergence`로** | 현재 교집합의 실제 의미이고, trace로 정확히 계산 가능. 즉시 필요(R3, R6, R8) |
| tension (두 태그의 긴장) | **조건부 채택 — `authored-pair`로** | 현재 코드에 존재하는 "긴장"은 사람이 작성한 쌍 목록뿐이다. 새로운 긴장 판단 규칙을 만들지 않고, 기존 목록 중 성립한 쌍과 그 출처(소스 내부 공존/소스 간 공존)만 기록한다 |
| complement | **기각** | 현재 데이터·목록 어디에도 "보완" 관계 정의가 없다. 사주 "보완 오행" 경로는 태그 관계가 아니라 소스 내부 규칙이며, trace ruleId로 이미 구분된다 |
| context-difference | **기각 (현재)** | 맥락(시기·관계·상황)별 Evidence가 없다. 타로 "현재 흐름"이 유일한 후보이지만 Identity에 불참한다 |
| unknown | **기각** | 기록할 필요가 없는 부재 상태. 누락은 이미 Evidence `status: missing`으로 표현된다 |
| conflictEngine 규칙 | **제외** | 태그 관계가 아니라 원천 속성 규칙이다. 현재 표시 전용이며, 2B에서 Identity와 연결하는 것은 별도 제품 결정 |

### PatternRecord 권장 여부

**범용 PatternRecord는 시기상조다.** 관계 종류를 늘리는 프레임워크나 관계 추론 규칙은 만들지 않는다.

다만 **Identity 선택을 개선하려면**, 그 전에 "현재 교집합과 공존을 출처와 함께 설명하는" 최소 기록이 필요하다. 이 기록은 두 가지 종류로 제한한다.

```ts
// 예비안 — 승인 전. trace에서 결정적으로 파생하며, 기존 결과를 구동하지 않는 단계부터 시작한다.
export type PatternRecord =
  | {
      kind: 'convergence';
      trait: CoreTag;
      claimIds: string[];        // 이 태그를 지지하는 Claim
      evidenceIds: string[];     // 서로 다른 Evidence (태양궁 이중 계산 제거 기준)
      sources: string[];         // 서로 다른 source
    }
  | {
      kind: 'authored-pair';
      traits: [CoreTag, CoreTag];
      ruleId: string;            // 예: 'identity.conflict-pair@1' — 기존 목록 식별
      claimIds: [string[], string[]];
      crossSource: boolean;      // 두 태그가 한 소스 안에서만 공존하는지 여부
    };
```

- 점수·가중치·confidence 필드를 두지 않는다. 수렴 강도는 `sources.length`로 **서술**만 한다.
- 새 태그 관계를 추가하지 않는다. `authored-pair`는 기존 `CONFLICT_IDENTITY` 목록을 그대로 참조한다.
- **저장:** 2B 첫 단계에서는 저장하지 않고 필요할 때 trace에서 계산하는 방안을 권장한다. 저장된 trace + 버전이 있는 ruleId에서 결정적으로 재계산할 수 있기 때문이다. 과거 결과에는 trace가 없으므로 소급하지 않는다.

## 6. 변경하지 말아야 할 것

- Phase 2B 첫 단계에서는 CoreTag 매핑·순서, Identity 선택 결과, 상세 해석 문장, 충돌 규칙, keywordStrengths, Destiny Code, 궁합, UI, 저장·legacy 의미, golden baseline을 변경하지 않는다.
- 사주 보완 경로 태그를 "보유 특성"으로 취급하는 현행 의미는, 제품 결정 전까지 유지한다.
- 섹션 5의 "검증처럼 들리는" 문구 변경은 제품 결정 사항이다. 2B 구현 범위에 섞지 않는다.
- 향후 Identity 선택 변경은 **의도된 출력 변경**이다. 이는 `ANALYSIS_ENGINE_VERSION`을 올리고 사용자 승인을 받은 golden 재설정으로만 한다. 조용한 재생성은 금지한다. 과거 저장 결과는 재해석하지 않는다(AD-002).

## 7. 최종 질문 답변

1. **실제 교집합의 정의:** 서양 점성술(태양+달+상승 합집합), MBTI, 사주, 혈액형 네 세트 중에서, **가장 많은 세트(k, 최소 2)에 동시에 나타나는 CoreTag들**이다. 문자열이 같은 태그만 인정한다. 순서는 최초 등장 순이다. 타로와 zodiac 단독 경로는 제외된다. 2세트 일치도 없으면 각 세트의 첫 태그를 쓴다.
2. **CoreTag 병합에서 잃는 것:** 태그별 지지 소스 수와 소스 이름, 사주 지배 경로와 보완 경로의 차이, placement별 차이(달·상승궁), 한 소스 안의 공존인지 여러 소스 간 공존인지, 소스의 세부 뉘앙스(원소·오행 강도·MBTI 개별 글자)다. 이 중 일부만 서술 단계에서 별도 조회로 되살아난다.
3. **충돌의 사용:** `conflictEngine` 결과는 표시 전용이다. Identity를 결정하는 "충돌"은 실제로는 태그 공존 목록이다. 상세 해석의 충돌 문장도 같은 공존 방식이다.
4. **Identity를 실제로 결정하는 것:** 사주·태양궁·혈액형·MBTI 합집합에서, 고정 목록 `CONFLICT_IDENTITY`의 **첫 번째로 성립하는 쌍**이다. 교집합은 0.2%의 fallback에서만 쓰인다.
5. **확인된 최대 구조적 원인:** 어휘의 대부분을 덮는 합집합에 대해 고정 순서 목록의 첫 일치를 고르는 Identity 규칙(R1+R2)이다. 1번 쌍 하나가 46.9%, 상위 4개가 91.5%다.
6. **Phase 2A trace로 가능해진 것:** 태그별 서로 다른 소스·Evidence 수 기반의 수렴 계산, 공존 쌍의 소스 내부/소스 간 구분, 사주 지배와 보완 경로의 구분, 누락 소스의 명시적 식별이다. 단 이것은 **매핑 일치의 서술**이지 성향의 검증이 아니다.
7. **최소 Phase 2B 추상화:** trace에서 파생하는 `convergence`와 `authored-pair` 두 종류의 기록이다. 기존 결과를 구동하지 않는 진단 단계부터 시작한다.
8. **PatternRecord 도입 여부:** 범용 PatternRecord는 도입하지 않는다. 위의 **두 종류로 제한한 판별 유니온**은 Identity 개선의 전제로서 도입할 가치가 있다. 다만 승인은 Codex 검토와 사용자 결정 이후다.
9. **변경하지 말아야 할 것:** 6절 참조. 특히 2B 첫 단계에서는 사용자에게 보이는 출력을 바꾸지 않는다.
10. **다양성을 가장 개선할 가능성이 높은 변경:** Identity 선택을 "목록 순서의 첫 공존 쌍"에서 "**교집합·수렴 근거를 반영한 쌍/단일 선택**"으로 바꾸는 것이다. 예: 수렴 소스 수가 큰 태그를 포함하는 쌍을 우선하고, 같은 소스 안에서만 공존하는 쌍은 후순위로 둔다. 이는 의도된 출력 변경이므로 제품 승인, 엔진 버전 증가, golden 재설정 절차가 필요하다. 그다음이 도달 불가 archetype(중복 쌍) 정리와 Identity 문장 풀 확장이다.

## 8. 구현이 정당화될 경우의 단계 (최대 3단계, 현재 미승인)

1. **다양성 측정 도구 (출력 변경 없음):** 이번 분석에 쓴 분포 측정을 `scripts/`의 결정적 스크립트로 추가한다. archetype 분포, 상위 집중도, 교집합과 Identity의 연결률을 기준값으로 기록한다. 이후 모든 변경의 "개선 여부" 판단 기준이 된다.
2. **`PatternRecord` 파생 (출력 변경 없음):** trace에서 `convergence`와 `authored-pair`를 계산하는 순수 함수를 추가하고 회귀 검사를 붙인다. Identity는 아직 바꾸지 않는다. 1단계 도구로 "새 규칙이었다면 어떤 분포가 나왔을지"를 오프라인으로 비교한다.
3. **Identity 선택 변경 (의도된 출력 변경, 별도 승인 필요):** 승인된 선택 규칙으로 교체한다. `ANALYSIS_ENGINE_VERSION`을 올리고, golden을 명시적으로 재설정하면서 변경 diff를 검토한다. 과거 저장 결과는 그대로 둔다.

---

# Phase 2A — 최종 독립 구현 검수

상태: 검수 완료 / 병합 준비 완료

## 최종 판정

**A. Ready to merge into main**

검수 대상은 `refactor/evidence-trace-phase2a`, 커밋 `6aae8ea` (`refactor: add evidence traceability`)이며 비교 기준은 `main...6aae8ea`이다. 브랜치·커밋 존재와 clean working tree를 직접 확인했다. 이전 C 판정은 구현 산출물 부재에 대한 당시 상태였으며 이번 판정으로 대체한다. 승인 설계와 Claude 독립 확인 부록은 아래에 보존한다.

BLOCKER 0 / IMPORTANT 0 / MINOR 0 / NON-BLOCKING 1. 병합 전 필수 수정 없음. 코드·테스트·baseline을 수정하거나 커밋·병합·push하지 않았다. 이번 검수는 두 협업 문서만 갱신한다.

## 실제 diff 및 동작 보존

애플리케이션 변경은 `analysis.ts`의 11줄 추가와 신규 `evidenceTrace.ts`로 제한된다. 신규 회귀 스크립트 외의 기존 테스트는 변경되지 않았다. 세 핵심 타입은 승인된 계약과 일치하며 `AnalysisSnapshot.trace`는 선택적이다.

- builder 호출은 기존 conflicts·keywordStrengths·merged coreTags 계산 이후다. 기존 계산 결과가 trace를 읽는 경로는 없다.
- CoreTag 테이블·순서, Identity, 충돌, 키워드 강도, Destiny Code, Narrative, 궁합, UI, 공유, 프로필, analytics, 저장 및 legacy 의미를 변경하는 diff가 없다.
- 사주와 점성술 계산을 다시 수행하지 않는다. 타입 전용 역방향 import이며 런타임 순환 의존성이 없다.
- Palm, Pattern/Relationship, NarrativePlan, LLM, confidence, trait 재설계, 플러그인 구조는 구현하지 않았다.

## 출처·결정성·저장 검수

1. **사주:** 실제 ELEMENT_CORE_TAGS 참조를 전달한다. 지배·첫 부족 오행의 Evidence와 규칙을 구분하고 최종 saju.coreTags에 남은 태그만 Claim으로 만든다. 두 경로의 중복 태그 근거는 보존하며 3개 제한에서 제외된 태그는 추가하지 않는다. 부족 오행이 없으면 보완 근거를 만들지 않는다. 시간 제공·정오 기본값은 별도 맥락으로 기록하고 Claim에 연결하지 않는다.
2. **MBTI·혈액형:** MBTI의 빈 유형은 missing/null 및 Claim 없음이다. MBTI는 type-mapping, 혈액형은 self-report 관찰에서 symbolic Claim으로 연결된다. 기존 lookup/fallback은 유지한다.
3. **점성술:** zodiac과 Sun placement는 동일 태양궁 Evidence를 공유하되 target과 ruleId가 구분된다. 달·상승궁 없음은 missing/null이고 Claim이 없다. isApproximate를 그대로 기록한다.
4. **타로:** 실제 사용한 카드만 기록하고 다시 추출하지 않는다. 타로 Claim이 있어도 merged coreTags와 Identity의 직접 태그 합집합에 추가하지 않는다.
5. **ID:** 문자열 기반의 결정적 ID이며 경로를 구분한다. 테스트 사례에서 모든 evidenceIds는 존재하는 available Evidence에 연결된다. 시간·난수·I/O가 builder에 없으며 원본 배열과 객체를 수정하지 않는다.
6. **저장:** 새 analyzeDestiny 결과에만 trace가 생성된다. 저장 엔진은 기존 JSON 보관 동작 그대로다. trace 포함 결과의 JSON round-trip, 중복 저장 원본 보존, trace 없는 v2·legacy의 조회·재저장·삭제 후 재저장 비소급 검사를 통과했다.

### 특별 항목 A — zodiac Claim ID

`zodiac:sun-sign:<tag>`는 적절하다. Sun placement의 `western-astrology:sun-sign:<tag>`와 충돌하지 않으며 같은 입력에서 안정적이다. Evidence 공유와 Claim 경로 분리를 정확히 나타낸다. 미래 소비자는 ID 문자열에서 출처를 추측하기보다 evidenceIds·target·ruleId를 사용해야 한다. ID 유일성 범위는 기존 설계대로 Snapshot 내부다. 이름 변경 불필요.

### 명세 대비 세부 선택

zodiacKey와 Sun signKey가 다를 때 별도 Evidence를 만드는 방어 분기는 현재 정상 엔진에서 실행되지 않는다. 실제 분석 사례는 동일한 태양궁을 공유하는지 검사하며 별도 fixture는 불일치가 잘못 병합되지 않음을 검사한다. 명세의 '불일치 보고'를 예외·로그 대신 별도 데이터로 표현한 선택으로 수용한다. 기존 출력에 영향을 주지 않는다. 같은 경로 내 중복 태그 제거도 현재 테이블의 동작을 바꾸지 않는다.

## 독립 실행 검증

| 검증 | 결과 |
| --- | --- |
| golden-analysis.ts | 7개 사례 통과 |
| regression-saved-context.ts | 전체 통과 |
| regression-evidence-trace.ts | 전체 통과, 218개 개별 assertion + 최종 PASS 출력 1개 |
| tsc --noEmit --incremental false -p . | 통과 |
| npm run build | 통과 |
| git diff --check main...6aae8ea | 통과 |
| 작업 문서 diff 검사 | 통과 |
| npm run lint | 기존 9건(오류 8, 경고 1), 신규 대상 파일 지적 없음 |

세 회귀 스크립트는 표준 `npx -y tsx` 명령으로 독립 실행했다. 보조적으로 로컬 TypeScript를 이용한 메모리 실행도 동일하게 통과했다. 최초 npm 접근 및 Google Fonts 다운로드는 제한 환경에서 실패했으나 네트워크 권한을 받아 표준 회귀 명령과 build를 재실행해 통과했다. 이는 구현 결함이 아니다.

baseline의 main/6aae8ea git blob은 모두 `d79d1fa2a61558a741e640e02ce385a6f24d2958`로 동일하다. 재생성하지 않았다. lint 지적 파일은 이번 구현에서 변경되지 않았다.

## 테스트의 의미와 한계

출력 태그 일치만 검사하는 테스트는 아니다. 실제 관찰값, ruleId·basis, 존재하는 참조, 사주의 명시적 중복·제한·무부족 fixture와 저장 이력을 검사하므로 잘못된 보완 경로와 3개 제한 누락 등을 탐지할 근거가 있다. 다만 모든 가능한 잘못된 참조를 증명적으로 배제하는 전수 검사는 아니다. 예를 들어 같은 규칙을 쓰는 placement 간 참조 교환을 직접 고정 기대값으로 검사하는 부분은 제한적이며, 현재 구현의 해당 연결은 코드로 별도 확인했다. Claude가 보고한 일시적 mutation 실험은 이번에는 코드 변경 금지에 따라 재실행하지 않았다.

### NON-BLOCKING 1 — 한 assertion의 이름과 실제 비교 범위 차이

`scripts/regression-evidence-trace.ts:220`의 'trace equals analyzeDestiny trace for same sources'는 직접 builder 결과 t1과 통합 결과를 비교하지 않고 analyzeDestiny를 두 번 호출해 비교한다. 실제로는 통합 경로 결정성 검사다. builder 결정성과 target별 실제 태그 비교는 다른 검사로 수행되므로 현재 병합을 막지 않는다. 향후 이 검사를 손볼 때 비교 대상이나 이름을 맞추면 된다. 이번 병합 전 수정 요구는 아니다.

## 특별 항목 B — Snapshot 크기

독립 실행에서도 trace 최대 5,773 **문자**, Snapshot 최대 13,015 문자, 저장 10건 176,695 UTF-8 bytes가 측정되었다. 문자 수를 bytes로 단정하지 않는다. 출력의 44%는 두 최대값으로 계산한 최종 Snapshot 내 trace 비중이며, 기존 대비 44% 증가라는 뜻이 아니다.

현재 10건 저장 규모에서 이 수치만으로 저장 구조를 바꿀 실질적 blocker는 없다. 브라우저별 localStorage 할당량·다른 키 사용량까지 보증하는 측정은 아니지만, 현재 코드나 검사에서 저장 실패는 확인되지 않았다. 새 인프라·압축·정규화는 요구하지 않는다.

## 다음 단계

사용자 승인 후 이 구현 브랜치를 main에 병합할 수 있다. 검수 문서 갱신은 아직 미커밋이며 필요하면 병합 전 문서 커밋으로 포함한다. 구현의 추가 수정은 필수가 아니다. 병합·push는 이번 작업에서 수행하지 않았다.

---

## 보존된 승인 설계

설계 상태: 검토 완료 / 구현 명세 승인. 구현 완료 여부는 위 최종 검수 상태를 따른다.

## 검토 기준과 결론

- 실제 확인한 브랜치·커밋: `main`, `81b0c90` (`docs: add AI collaboration protocol`). Phase 1 수정 `89dcbd7` 포함.
- 검토 시작 시 working tree는 clean이었다.
- 협업 문서 4개와 실제 분석·점성술·저장·활성 결과·golden 검사 코드를 확인했다.
- 기존 설계와 중요한 불일치 없음. 선행 수정이 필요한 blocker 없음.
- 이번 작업은 문서 작성이다. 아래 타입과 절차는 구현 명세이며 구현 완료를 뜻하지 않는다.

## 범위와 불변 조건

목표는 **각 소스의 기존 CoreTag가 어떤 입력 또는 계산 관찰과 매핑에서 나왔는지** 기록하는 것이다.

```text
기존 입력 → 기존 계산·매핑 → 기존 CoreTag / Identity / Narrative
                      └→ EvidenceRecord → InterpretationClaim → Snapshot.trace
```

trace는 기존 결과의 소비자이며 기존 해석을 구동하지 않는다. 모든 Claim을 합쳐 기존 coreTags를 대체하지 않는다. Identity의 첫 일치 규칙 선택, 직접 조건 기반 충돌, Narrative 전체 문장까지 추적하는 단계는 아니다.

변경 금지: CoreTag 매핑·순서, Identity 선택, 충돌 규칙, 키워드 강도, Destiny Code, Narrative, 궁합, UI, 저장 ID·시각·중복 방지·legacy 의미, 공유·프로필·analytics payload. Palm, Pattern/Relationship Engine, NarrativePlan, LLM, 사용자 피드백, 종합 confidence, 범용 소스 프레임워크는 범위 밖이다.

## 정확한 권장 타입

신규 `app/lib/evidenceTrace.ts`에 둔다. 기존 타입은 `import type`으로만 참조한다.

```ts
export type EvidenceRecord = {
  id: string;
  source: string;
  kind: "self-report" | "calculated" | "symbolic" | "image-observation";
  feature: string;
  value: string | number | boolean | null;
  status: "available" | "missing" | "unreadable";
};

export type InterpretationClaim = {
  id: string;
  trait: CoreTag;
  evidenceIds: string[];
  ruleId: string;
  basis: "type-mapping" | "symbolic";
  target: string;
};

export type AnalysisTrace = {
  version: 1;
  evidence: EvidenceRecord[];
  claims: InterpretationClaim[];
};
```

- `available`은 값 확보 상태이며 계산 정확성·성격 해석 타당성을 보증하지 않는다. missing/unreadable은 null로 표현하고 실제 false/0과 구분한다.
- MBTI 유형의 자기보고에서 파생한 태그는 성향 자체의 자기보고가 아니므로 Claim basis는 `type-mapping`이다. 나머지 현재 태그 해석은 `symbolic`이다. 신뢰도 등급이 아니다.
- `target`은 기존 태그 배열 경로 식별자다. 동적 경로 실행기를 만들지 않는다.
- ruleId에 `@1`을 넣어 매핑 버전을 식별한다. 별도 레지스트리는 불필요하다.
- ID는 Snapshot 안에서 유일하고 결정적이어야 한다. 예: Evidence `saju:dominant-element`, Claim `saju:dominant-element:분석적`. target·근거 경로가 다르면 구분한다. 분석 간 식별은 기존 analysisId와 조합한다. 시간·난수를 사용하지 않는다.
- 배열 처리 순서는 사주, MBTI, 혈액형, 기존 zodiac, 점성술 placement(태양·달·상승궁), 타로로 고정하고 각 태그 순서는 원본을 따른다.

## 정확한 통합 지점

`app/lib/analysis.ts`의 `analyzeDestiny()`에서 기존 conflicts·keywordStrengths·merged coreTags 계산 후 최종 return 직전에 순수 함수 `buildAnalysisTrace()`를 호출한다.

입력은 현재 지역 변수인 `saju`, `zodiacKey`, `zodiac`, `westernAstrology`, `mbtiData`, `bloodTypeData`, 최종 `tarot`를 묶는다. 기존 `ELEMENT_CORE_TAGS` 참조를 별도 인자로 전달한다.

builder 내부에서 Evidence를 만든 뒤 실제 반환된 태그와 매핑에 Claim을 붙인다. source 계산·음양력 변환·타로 추출은 다시 실행하지 않는다. 매핑 테이블을 복제하거나 입력 객체·공유 상수 배열을 변경하지 않는다. 사주 외에는 반환된 태그와 조회 키만으로 기록할 수 있다.

analysis.ts는 builder를 런타임 import하고 AnalysisTrace는 type import한다. 반대 방향 런타임 import로 순환 의존성을 만들지 않는다. calcSaju·calcWesternAstrology의 반환 계약과 계산식은 유지한다.

## 소스별 규칙

### Saju

실제 위치: `analysis.ts`의 `ELEMENT_CORE_TAGS`, `calcSaju()`.

현재 지배 오행 태그 + 첫 부족 오행 태그를 중복 제거하여 앞의 3개만 유지한다. 부족 오행이 없으면 지배 오행을 다시 사용한다.

- Evidence: source `saju`, kind `calculated`, feature `dominant-element`, 실제 dominantElement.
- 첫 부족 오행이 있을 때만 feature `first-missing-element`, 값 missingElements[0]을 추가한다. 없으면 가상의 부족 오행·보완 Claim을 만들지 않는다.
- target `saju.coreTags`, basis `symbolic`.
- ruleId: `saju.dominant-element-tags@1`, `saju.missing-element-compensation@1`.
- 기존 ELEMENT_CORE_TAGS에서 경로별 기여를 확인하고 **최종 saju.coreTags에 남은 태그만** Claim으로 기록한다. 지배 경로 다음 보완 경로 순서다.
- 같은 태그가 두 경로에서 나오면 두 Claim을 보존할 수 있다. trait를 순서대로 중복 제거하면 기존 coreTags와 같아야 한다.
- 3개 제한에서 제외된 태그를 출력 Claim으로 남기거나, 모든 태그를 지배 오행에서 나왔다고 기록하지 않는다.
- hasTime은 feature `birth-time-provided`, kind `self-report`, boolean으로 기록한다. 미입력이면 feature `calculation-time-default`, kind `calculated`, value `12:00`도 기록한다. 이는 계산 맥락이며 태그의 직접 근거로 연결하지 않는다. 기존 정오 대체 동작은 유지한다.

### MBTI

실제 위치: `analysis.ts`의 MBTI_DATA 및 `MBTI_DATA[mbti] ?? NULL_MBTI`.

- Evidence: source `mbti`, kind `self-report`, feature `type`, 인식된 mbtiData.type.
- 빈 유형이면 missing/null이고 Claim 없음. 새 입력 검증 정책은 만들지 않는다. 원시 입력의 오류와 미입력을 세분화하는 단계는 아니다.
- 실제 mbtiData.coreTags 순서대로 Claim 생성.
- target `mbtiTraits.coreTags`, ruleId `mbti.type-tags@1`, basis `type-mapping`.

### Blood type

실제 위치: `analysis.ts`의 BLOOD_TYPE_DATA 조회.

- Evidence: source `blood-type`, kind `self-report`, feature `type`, bloodTypeData.type.
- 실제 bloodTypeData.coreTags 순서대로 Claim 생성.
- target `bloodType.coreTags`, ruleId `blood-type.symbolic-tags@1`, basis `symbolic`.
- 새로운 기본 혈액형이나 유효성 정책을 추가하지 않는다.

### Western astrology 및 기존 zodiac

두 실제 경로를 보존한다:

1. analysis.ts의 calcZodiacSign → ZODIAC_DATA[zodiacKey] → zodiac.coreTags.
2. westernAstrology.ts의 calcWesternAstrology → SIGN_DATA의 태양·달·상승궁 태그 → 순서대로 합집합.

- Evidence: source `western-astrology`, kind `calculated`, feature `sun-sign`/`moon-sign`/`ascendant-sign`, 값은 각 signKey.
- 현재 같은 태양궁을 사용하는 두 매핑은 하나의 태양궁 Evidence를 공유한다. 테스트에서 zodiacKey와 westernAstrology.sun.signKey의 일치를 확인한다. 다르면 조용히 합치지 말고 불일치로 보고한다.
- 기존 zodiac Claim: 실제 zodiac.coreTags, target `zodiac.coreTags`, ruleId `zodiac.sign-tags@1`.
- placement Claim: 실제 placement.data.coreTags, target `westernAstrology.sun.data.coreTags` / `westernAstrology.moon.data.coreTags` / `westernAstrology.ascendant.data.coreTags`, ruleId `western-astrology.placement-tags@1`.
- basis는 symbolic. 두 태양궁 매핑을 독립적인 행동 증거 두 개로 취급하지 않는다.
- 달·상승궁 null이면 missing Evidence만 생성한다. Claim 없음.
- isApproximate는 별도 feature `is-approximate`, kind calculated인 boolean Evidence로 기록한다. 성격 신뢰도로 변환하지 않는다.
- 합집합에 새 Claim을 중복 생성하지 않는다. placement 순서로 trait를 합쳐 중복 제거한 값이 westernAstrology.coreTags와 같은지 검증한다.

### Tarot

실제 위치: analysis.ts의 TAROT_DATA, `selectedCard ?? calcTarot()`.

- Evidence: source `tarot`, kind `symbolic`, feature `card-number`, 최종 tarot.number.
- 실제 tarot.coreTags 순서대로 Claim 생성.
- target `tarot.coreTags`, ruleId `tarot.card-tags@1`, basis symbolic.
- 카드를 다시 뽑지 않는다. 최소 범위에는 선택 방식 추적 필드가 필요하지 않다.
- 현재 상세 해석 등에 사용되지만 merged coreTags와 Identity의 직접 태그 합집합에는 제외된다. trace 때문에 이 범위를 변경하지 않는다.

## Snapshot 저장·호환 정책

AnalysisSnapshot에 `trace?: AnalysisTrace`만 추가한다. AnalysisOutput은 유지한다.

새 분석에 trace를 생성·저장한다. 메모리에만 만들면 저장 결과의 출처를 잃으며, 나중에 현재 규칙으로 재생성하면 과거 근거와 달라질 수 있다.

- 기존 v2는 trace 없이도 v2다. legacy도 그대로 읽는다.
- 조회·재저장·삭제 후 재저장 시 과거 trace를 생성·보충하지 않는다.
- schemaVersion 2와 기존 ANALYSIS_ENGINE_VERSION을 유지한다. 선택적 필드 추가이며 해석 규칙 변경이 아니다. trace 구조는 trace.version으로 구분한다.
- 저장 ID·시각·중복·legacy 판정은 수정하지 않는다. 저장 함수는 resultData 전체를 JSON으로 보관하므로 변경 불필요하다.
- UI·공유·프로필·궁합·analytics·Supabase에 trace를 사용·전송하지 않는다.
- 원본 생년월일·좌표·전체 계산 과정·설명 문장·매핑 테이블을 복제하지 않는다. 이번은 계산 관찰에서 시작하는 출처 추적이며 전체 입력 재실행 기록은 아니다.

## Palm 계약 경계

향후 source palm, kind image-observation으로 선의 가시성(boolean), 형태(string), 비율(number), 판독 불가(null/unreadable)를 표현할 수 있다. 이미지 품질도 별도 feature로 표현한다. `image-quality = low`, status available은 품질 등급을 확보했다는 의미다.

품질을 성격 Claim 신뢰도로 자동 전달하지 않는다. 상징적 해석은 별도 ruleId의 Claim으로 연결할 수 있지만 타당성은 별도 문제다. 이번에는 이미지·Vision·Palm 매핑을 구현하지 않는다. 관찰 품질·계산 정확성·해석 타당성·사용자 경험 일치를 하나의 점수로 합치지 않는다.

## 변경 예상 파일

| 파일 | 변경 범위 |
| --- | --- |
| 신규 app/lib/evidenceTrace.ts | 타입, 순수 builder와 소스별 작은 함수 |
| app/lib/analysis.ts | import, 선택적 trace 필드, 최종 조립 호출 |
| 신규 scripts/regression-evidence-trace.ts | 근거·태그 일치·저장 호환성 검사 |

기존 매핑·해석 함수, UI, activeAnalysis, storageEngine, westernAstrology, conflictEngine, keywordEngine, destinyCode, compatibilityEngine, profileStore, analyticsEngine, Supabase schema는 수정 대상이 아니다. 기존 테스트와 golden 기대값을 변경하지 않는다. 구현 보고는 협업 절차에 따라 docs/ai/CLAUDE_REPORT.md에 기록한다.

## 회귀·수용 기준

1. 기존 golden과 saved-context 스크립트를 변경 없이 통과한다. golden-baseline.json 재캡처 금지. golden은 trace 외의 기존 분석·파생 필드를 비교한다.
2. 새 검사는 작은 assertion과 메모리 localStorage stub으로 충분하다. 대형 프레임워크는 불필요하다.
3. Evidence/Claim ID 유일성, 비어 있지 않은 evidenceIds, 모든 참조의 존재와 available 상태를 확인한다.
4. 각 target에서 Claim trait를 순서대로 중복 제거하면 기존 태그와 같아야 한다. value와 ruleId의 기대값도 검사해 태그만 복사한 잘못된 출처를 탐지한다.
5. 사주 지배·보완 경로, 중복 근거, 부족 오행 없음, 3개 제한, 시간 미입력 맥락을 확인한다. 필요한 경우 builder에 작은 명시적 fixture를 사용한다.
6. MBTI·달·상승궁 누락, 태양궁 두 경로, 타로의 기존 합집합 비참여를 확인한다.
7. 동일 source 결과에서 동일 trace가 나오고 입력 객체가 변경되지 않아야 한다. trace에는 난수·시간·I/O가 없다. 선택 카드 없는 경로의 카드 선택·난수 호출도 바꾸지 않는다.
8. trace 포함 Snapshot의 JSON 저장·조회 깊은 동등성과 동일 분석 재저장의 원본 보존을 확인한다.
9. trace 없는 v2와 실제 legacy 형태 fixture를 별도로 만들어 trace가 소급 추가되지 않는지 검사한다. 새 Snapshot에서 schemaVersion만 제거한 fixture로 두 경우를 대신하지 않는다.
10. 대표 trace와 최대 10개 저장 목록의 JSON 크기를 보고한다. 원문·입력 전체 중복으로 불필요하게 커지지 않았는지 확인한다.
11. build, lint, diff 검사를 수행한다. 기존 lint 항목과 신규 항목을 구분한다. golden 불일치는 재생성하지 말고 중단·보고한다.

```sh
npx -y tsx scripts/golden-analysis.ts
npx -y tsx scripts/regression-saved-context.ts
npx -y tsx scripts/regression-evidence-trace.ts
npm run build
npm run lint
git diff --check
```

## Claude 구현 계획 — 3단계

1. **순수 trace 모듈**: 타입과 소스별 생성 규칙을 구현하고 작은 fixture로 출처·태그 일치를 검증한다. 기존 엔진은 변경하지 않는다.
2. **Snapshot 연결**: analyzeDestiny 최종 조립에 trace만 추가한다. 과거 결과는 건드리지 않는다. 기존 golden과 저장 컨텍스트 검사를 통과시킨다.
3. **집중 회귀·보고**: 새 회귀 스크립트와 수용 기준을 완성하고 build·lint·diff·저장 크기를 확인한다. 결과와 한계를 CLAUDE_REPORT에 기록한다.

## 최종 판정

**Phase 2A 구현 진행 가능. 선행 필수 수정 없음.** 기존 설계와 중요한 불일치 없음. 소스별 규칙·ID·저장·회귀 기준을 구체화한 명세다. 구현 범위는 위 내용으로 제한하고 최종 병합 여부는 구현 검수 후 판단한다.

## 부록 — Claude Code 독립 확인 (main `81b0c90` 기준)

위 명세의 사실 주장을 실제 코드와 대조했다. 방향과 충돌하는 불일치는 없다. 구현 시 아래 세부만 명확히 한다.

1. **태양궁 두 경로는 항상 같다.** `calcZodiacSign()`(analysis.ts)과 `calcWesternAstrology()`의 태양궁(westernAstrology.ts)은 모두 같은 양력 날짜로 `calcSunSignKey(month, day)`를 호출한다. 따라서 `zodiacKey === westernAstrology.sun.signKey` 검사는 현재 항상 통과하는 방어용 assertion이다. 하나의 태양궁 Evidence 공유는 타당하다.
2. **"시간 입력" 판정이 두 곳에서 다르다.** 사주는 `birthtime.length > 0`이고 미입력 시 12:00이다. 서양 점성술은 `birthtime.length >= 4`이고 미입력 시 0:00이며, 달·상승궁은 계산하지 않는다. `birth-time-provided`와 `calculation-time-default`는 사주 Evidence(`saju.hasTime`)에서만 만든다. 서양 점성술 쪽 시간 여부는 달·상승궁의 missing 상태로만 표현한다. 두 판정을 하나로 합치거나 고치지 않는다.
3. **`isApproximate`는 원래 값 그대로 기록한다.** 현재 `isApproximate: hasTime`이다. 즉 시간이 있어 달·상승궁을 근사 계산했을 때 true다. Evidence에는 이 값을 그대로 기록하고, 이름에서 짐작되는 의미로 뒤집거나 재해석하지 않는다.
4. **태그 경로를 확인했다.** Identity(`generateIdentity`)의 직접 태그 합집합은 사주·`zodiac`·혈액형·MBTI이며 타로는 제외된다. 상세 해석(`generateDetailedReading`)은 타로를 포함한다. Snapshot의 merged `coreTags`는 `zodiac.coreTags`가 아니라 `westernAstrology.coreTags`를 쓴다. 명세의 두 경로 보존 규칙이 이 구조와 맞다.
5. **혈액형 조회에는 fallback이 없다.** `BLOOD_TYPE_DATA[bloodtype]`에 기본값이 없다. 폼이 혈액형을 필수로 요구하므로 현재 문제는 없다. 명세대로 새 기본값이나 검증을 추가하지 않는다.
