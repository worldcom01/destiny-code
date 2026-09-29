# Identity Selection v2 — 설계 검토 (2026-09-30)

## 결론과 승인 경계

현재 `main` **`2746b5e`**의 실제 코드와 Phase 2B 문서를 검토했다. **Option B: 대표 convergence 우선 → 약한 쪽의 출처 수 → 양쪽 출처 합집합 → 기존 authored 순서**를 권장한다. 가중 점수나 분포 균등화 없이 설명 가능한 우선순위다. 아래 측정 결과와 경계 사례를 기준으로 구현 명세를 확정할 준비가 됐다. 다만 신규 결과의 Identity가 약 67.18% 바뀌므로 **사용자의 제품 변경 승인 후 구현**한다. 이 문서는 구현·출시 승인 자체가 아니다.

이번 작업은 설계 검토와 임시 측정만 했다. 애플리케이션, 테스트, golden baseline, engineVersion을 수정하지 않았다. 이전 검수 이력은 아래에 보존한다. `CLAUDE_REPORT.md` 상단의 미병합 상태는 당시 보고이며, 현재 git과 `CURRENT_PHASE.md`의 완료 기록을 우선했다.

## 1. 현재 v1의 편향과 서로 다른 분석 범위

`app/lib/analysis.ts`의 `generateIdentity()`는 사주·zodiac·혈액형·입력된 MBTI 태그의 **합집합**에서 두 태그가 있으면 첫 `CONFLICT_IDENTITY`를 즉시 선택한다. 교차 출처 여부·대표 교집합·지지 출처 수를 비교하지 않는다. 첫 항목인 독립적+포용적이 있으면 이후 후보는 평가되지 않는다. 후보가 전혀 없을 때만 `commonKeywords[0]`에 대응하는 single Identity를 사용한다. 이것이 유사 결과와 authored 순서 편향의 직접 원인이다.

혼동하면 안 되는 네 범위:

| 항목 | 실제 범위와 의미 |
| --- | --- |
| merged `coreTags` | 사주 + 서양 점성(태양·달·상승) + MBTI + 혈액형 합집합 |
| `commonKeywords` | 서양 점성 전체를 한 세트로 보고 MBTI·사주·혈액형과 비교. 가장 많은 세트에 겹치는 태그들을 반환. 동률은 최초 등장 순서(서양 점성부터) |
| authored-pair 후보 | 사주 + **zodiac 경로** + MBTI + 혈액형. 달·상승 단독 태그는 후보를 만들지 않음 |
| `keywordStrengths` | 태양·달·상승을 각각 세므로 convergence의 distinct-source 수와 다름. 상위 5개 및 반올림 percentage도 있으므로 랭킹 입력으로 사용하지 않음 |

Tarot는 이 네 선택 범위에 추가하지 않는다. `AnalysisPattern`의 convergence는 available Evidence에 연결된 Claim만 사용하고 source를 중복 제거한다. 서양 점성 placement 여러 개, zodiac/sun 중복, 사주 dominant/compensation 중복은 각각 같은 source 한 표다. 이러한 체계 간 일치는 경험적으로 독립된 관측이나 성향의 검증을 의미하지 않는다.

## 2. 권장 알고리즘 — 정확한 규칙

입력은 **새 분석에서 이미 생성한 trace, 기존 commonKeywords, 사주 첫 태그, 변경하지 않은 authored catalog**다. 선택 함수는 순수 함수이며 시간·난수·네트워크·사용자 이력을 읽지 않는다. 새 snapshot 전체의 analysisId/createdAt이나 카드 추출까지 결정적으로 만들라는 요구는 아니다. 동일 trace와 동일 분석 입력의 **Identity 선택**이 결정적이어야 한다.

1. `deriveAnalysisPatterns(trace, IDENTITY_PAIR_DEFINITIONS)`로 기존 convergence와 authored-pair를 구한다. 후보 자격은 **기존 authored-pair와 동일**하게 유지한다. 달·상승을 후보 자격에 추가하지 않고 기존 패턴 의미도 바꾸지 않는다.
2. 실제 convergence가 있을 때만 `commonKeywords[0]`의 CoreTag를 대표 태그 R로 삼는다. R이 convergence에 있고 최대 source 수를 갖는지 검증한다. commonKeywords fallback을 convergence인 것처럼 취급하지 않는다. 동률 대표 태그는 기존 commonKeywords 순서를 보존한다. 서로 다른 선택용 대표 태그를 새로 만들어 화면과 어긋나게 하지 않는다.
3. 후보 P=(A,B)의 `S(A)`, `S(B)`는 **convergence 범위**의 available Claim에 연결된 distinct source 집합이다. convergence pattern이 있는 태그는 그 sources/claimIds를 사용한다. 없는 태그도 같은 target allowlist로 전체 지지를 모으되 한 출처를 여러 표로 세지 않는다. 현재 유효 후보에서 convergence 없는 태그는 source 1개이고 기존 pair support와 일치한다.
4. convergence가 있고 후보도 있으면 다음 튜플을 **사전식 내림차순**으로 비교한다.

   `([A,B]에 R 포함 ? 1 : 0, min(|S(A)|, |S(B)|), |S(A) ∪ S(B)|)`

   세 값이 같으면 `pairIndex` 오름차순으로 결정한다. 배열 sort의 암묵적 안정성에 의존하지 않는다. source/claim 배열 순서가 달라도 집합 수와 선택은 동일하다. 출력 provenance 배열은 고정 순서로 정렬한다.
5. convergence가 없으면 기존 첫 matching pair를 유지한다. 후보가 없으면 기존 single fallback(`commonKeywords[0]`의 태그, 없으면 사주 첫 태그), 마지막 generic fallback을 그대로 쓴다. trace가 없는 **과거 저장 결과에는 이 함수를 호출하지 않는다**. 새 분석에서 trace 누락·대표 태그 불일치는 잘못된 통합이므로 조용히 v1 결과를 v2로 표시하지 말고 회귀 검사/불변식 오류로 검출한다.

대표 태그를 포함하는 후보가 없다면 첫 항목은 모두 0이다. 이 경우 나머지 두 항목으로 비교한다. 기존 순서는 마지막 동률 해소 수단이다. 모든 후보가 한 출처에만 의존하면 min=1·union=1로 동률이므로 기존 순서가 유지된다. 한쪽만 여러 출처에서 지지되는 경우 양쪽 모두 두 출처 이상인 후보보다 min이 낮다(대표 태그 포함 여부가 같을 때). 후보가 하나면 그대로 선택하며 동률 fallback으로 세지 않는다.

**세 항목의 이유:** 대표 태그 포함을 최우선으로 두어 현재 화면에 보이는 교집합과 연결한다. min은 양쪽 모두 지지되는 쌍을 우선하며 3/3을 2/2보다 강하게 취급한다. union은 같은 min에서 더 여러 체계를 연결하는 쌍을 우선한다. 별도의 both-sides boolean은 min과 중복되고, claim 수는 중복 경로를 보상하므로 사용하지 않는다. max·총합·sharedSources 보너스까지 추가할 근거는 아직 없다. 따라서 같은 min·union인 2/2와 2/3은 기존 순서로 결정될 수 있다. 이는 의도한 최소 규칙이다.

`sharedSources`가 많다고 감점하지 않는다. 여러 source가 두 태그를 모두 지지하는 2/2는 좋은 교차 출처 겹침이다. sharedSources가 비어 있다고 자동으로 더 강하지도 않다(1/1일 수 있음). 서로 다른 source로 두 편을 지지할 수 있는지는 양쪽이 비어 있지 않고 union≥2인지로 설명할 수 있다. 이를 통계적 독립성으로 표현하지 않는다.

**두 provenance 범위는 구분해 보존한다:** 기존 authored-pair support는 후보가 된 근거이고, ranking support는 달·상승을 포함하는 convergence 범위의 근거다. 후자를 전자에 덮어쓰지 않는다. 미래 UI가 “달에서만 나온 태그로 pair가 만들어졌다”고 설명하면 잘못이다.

## 3. 실제 비교 측정

현재 diagnostic의 mulberry32, seed 12345, 날짜·시간·좌표·MBTI·혈액형 설정을 그대로 사용하고 `effectiveKey`별 첫 행만 남겼다. **19,983개 고유 입력**을 한 번씩 평가했다. 기존 보고의 20,000행 가중 비율과 분모가 다르므로 아래 v1부터 다시 측정했다. 고정 Tarot·성별, 기존 분석 결과/trace에서 선택만 모의 평가했다. 모든 옵션을 두 번 실행했고 전체 결과 JSON이 동일했다. 합성 혼합 표집이며 실제 사용자 빈도 추정이 아니다.

| 지표 | v1 | A 최소 convergence 우선 | B 권장 provenance 비교 | C 중복 정의만 제거 |
| --- | ---: | ---: | ---: | ---: |
| 관측 archetype / 기존 21 | 13/21 | 13/21 | 13/21 | 13/21 |
| 상위 1개 | 48.08% | 24.30% | 23.68% | 48.08% |
| 상위 4개 | 92.08% | 72.23% | 66.89% | 92.08% |
| 대표 교집합 불일치 / pair 선택 | 84.60% | 34.72% | 34.72% | 84.60% |
| 기존 순서 사용 / 전체 입력 | 99.42% | 61.78% | 36.60% | 99.42% |
| 양쪽 모두 cross-source / pair 선택 | 22.60% | 32.31% | 45.12% | 22.60% |
| v1 대비 Identity 변경 / 전체 입력 | 0% | 49.59% | **67.18%** | 0% |

정확한 분모는 전체 19,983, pair 19,868, single/generic 경로 115다. A/B 불일치는 6,899/19,868, B 양쪽 cross-source는 8,964/19,868, 변경은 **13,424/19,983**, 기존 순서 사용은 7,314/19,983이다. “기존 순서 사용”은 v1/C의 모든 pair 경로 또는 A/B의 convergence 부재 경로 및 최고 튜플 후보가 둘 이상인 동률을 뜻한다. 단순히 v1과 같은 결과를 고른 비율이 아니다. 중복 pair #3/#8의 동률도 포함한다. no-pair single 경로는 이 비율에서 제외한다. cross-source 양쪽 지표는 위에서 정의한 **ranking support 범위**로 통일해 비교했다.

B 상위 순서는 틀 안의 반항자 4,731, 의심하는 직관가 3,265, 멈추는 추진력 2,750, 외로운 연결주의자 2,621건이다. 상위 비율이 낮아졌다는 이유가 아니라, A와 같은 대표 태그 정합성을 유지하면서 양쪽 교차 출처 지지가 **32.31→45.12%**로 개선되고 순서 의존이 줄어 B를 권장한다.

남은 불일치의 구조: convergence가 있으나 대표 태그를 포함한 matching pair가 없는 사례 **6,886건**, convergence 자체가 없는 사례 전체 **15건** 중 pair 불일치 **13건**이다. 따라서 현재 후보 범위와 기존 single 정책을 유지하는 한 6,899건은 이 지표의 도달 가능한 최솟값이다. 34.72%를 숨기거나 0%라고 약속하지 않는다. 후보/카탈로그 확장 또는 pair 대신 single 선택은 별도 제품 변경이다.

재현 방법: 기존 diagnostic의 입력 생성과 key를 재사용 → 첫 key만 유지 → analyzeDestiny 고정 카드 → deriveAnalysisPatterns → 위 규칙으로 archetype 선택 → key 순서대로 지표 집계. 임시 측정 파일은 `/tmp/destiny-v2-design.cjs`, 결과는 `/tmp/destiny-v2-results.jsonl`에 뒀으며 저장소에 구현 코드를 추가하지 않았다. B 선택 digest는 **`ed598f84`**다(초깃값 5381의 기존 djb2 방식으로 `effectiveKey=archetype\n` 누적 후 unsigned hex). 이 digest는 20,000행 입력+키워드를 포함하는 기존 **`ca1e44df`와 정의가 다르다**. 구현 회귀에서는 둘을 혼용하지 않는다.

## 4. 대안별 장단점과 위험

**A — 최소 convergence 우선:** 실제 convergence가 있을 때 `(대표 태그 포함)`만 비교하고 기존 순서로 해소한다. 나머지 fallback은 권장안과 같다. 코드가 가장 작고 대표 교집합 불일치를 B와 같은 최소값까지 낮춘다. 하지만 같은 대표 태그 후보들 사이에서 한쪽만 지지되는 pair를 먼저 고를 수 있고, 61.78%가 순서를 사용한다. 신규 Identity 49.59% 변경이므로 A도 무위험 변경이 아니다.

**B — 권장:** 위 3항목 튜플이다. 같은 대표 태그 조건에서 약한 쪽 지지와 서로 다른 체계 연결을 비교한다. 고정된 10개 pair와 짧은 trace를 순회하므로 복잡도·비용이 작다. 두 support 범위를 명시해야 하고, 대표 태그의 기존 동률 순서와 사주 보완 의미는 그대로 남는다. 변경 범위가 67.18%이므로 버전·golden·설명 기록이 필요하다. 분포가 평탄해진 것이 채택 이유는 아니다.

**C — 현 선택 + 중복 카탈로그 정리:** 순서/선택은 그대로 두고 zero-based #8(창의적+체계적, 안전한 탐험가)을 제거/비활성화한다. #3이 이미 같은 두 태그로 먼저 선택되므로 결과 변화는 0이고 편향도 그대로다. 비교표는 기존 21개를 분모로 유지했지만 활성 정의 수는 20개가 된다. 도달 불가능한 정체성을 살아 있게 만들려면 #8에 새로운 조건·태그를 부여하거나 이름/문구를 합쳐야 하며, 그것은 내용 설계 없이는 평가할 수 없다. 복잡도는 가장 낮지만 목적을 달성하지 못한다. v2와 자동 결합하지 않는다.

## 5. Catalog, Saju, conflict 결정

**현재 catalog를 v2에 유지할 수 있다.** 정확히는 pair 10개 + single 10개 + generic 1개로 21개이며, 21개의 독립된 pair가 아니다. 10개 태그의 서로 다른 unordered pair 45가지 중 고유 authored pair는 **9가지**뿐이다. 모든 태그는 single 문구가 있지만, pair 자격이 있는 한 single을 억제하는 정책이 있다. 표본에서 13개가 관측됐다고 나머지 모두 도달 불가능하다고 말하지 않는다. 구조적으로 확정된 중복은 #8=#3이며 B에서도 점수가 같아 #8은 여전히 선택되지 않는다.

이번에는 목록·문구·인덱스를 고정한다. #8을 억지로 선택하기 위해 빈도 보정이나 특수 tie-break를 넣지 않는다. 이후 catalog 전용 검토에서 중복 폐기/통합/새 조건 부여와 미포함 조합의 의미적 커버리지를 다룬다. 태그 공존이 기존 문구의 심리적 긴장을 입증하지 않는 한계 역시 선택 규칙만으로 해결되지 않는다.

**Saju 선택: A — v2에서는 현행 처리 유지.** `calcSaju`가 dominant 태그와 첫 missing-element 보완 태그를 합쳐 중복 제거 후 3개로 자른다. trace는 두 ruleId를 구분하지만 현재 product 결과는 둘 다 교집합용 CoreTag다. 보완-only source를 제거/감점하면 화면 commonKeywords는 그대로인데 선택용 convergence만 달라져 이번 개선 목적과 충돌한다. 따라서 둘 다 source `saju` 한 표로 유지하되, reason에서 claimId를 보존해 보완 근거임을 추적한다. 이를 “실제로 갖춘 성향”으로 새로 단정하지 않는다. 보완과 소유 성향을 분리할지는 향후 commonKeywords·keywordStrengths·서술까지 함께 검토할 의미 변경이다. dominant와 compensation의 이중 claim으로 사주를 두 표 세는 것은 금지한다.

**conflicts는 이번 v2에서 사용하지 않는다.** `ConflictPattern`은 title/description뿐이고 최대 3개로 잘린다. 정규 trait 쌍·ruleId·claim provenance가 없다. authored-pair 역시 이름에 conflict가 있어도 두 태그 공존이지 실제 conflictEngine 검출이 아니다. 제목 문자열 매칭·개수 보너스·누락을 “긴장 없음”으로 해석하는 방법은 부적합하다. 현 conflict 출력과 순서를 유지한다.

## 6. 최소 설명 기록과 통합 지점

`AnalysisTrace`는 입력→기존 CoreTag의 provenance를 유지한다. 선택 결정을 trace에 섞지 않는다. `AnalysisSnapshot`에 **optional `identitySelection`**을 추가하고 새 engine v2 생성 시에는 반드시 채운다. 과거 결과는 비어 있어도 정상이다. runtime에서 최신 catalog로 역사적 선택 이유를 재계산하지 않는다.

권장 내부 자료형(설계 명세이며 구현 아님):

```ts
type IdentitySelectionReason = {
  version: 1; // 설명 데이터 형식, engineVersion과 별개
  ruleId: 'identity.selection@2';
  representativeTrait: CoreTag | null; // 실제 convergence일 때만
  decision: 'ranked-pair' | 'no-convergence-pair' | 'single' | 'generic';
  pairIndex: number | null; // 고정 catalog의 위치, engineVersion으로 의미 고정
  selectedTraits: CoreTag[];
  usedAuthoredOrder: boolean; // 최고 튜플 동률 또는 no-convergence pair
  support: Array<{
    trait: CoreTag;
    claimIds: string[]; // convergence 범위, available Evidence만
    sources: string[]; // distinct source
  }>;
};
```

pair 선택이면 support는 두 태그 순서, single이면 선택된 한 태그, generic이면 빈 배열이다. Evidence는 저장된 trace의 claim 연결로 따라간다. 튜플·union·sharedSources는 이 기록에서 계산할 수 있어 중복 저장하지 않는다. 후보 자격 support는 같은 snapshot trace와 버전 고정된 authored-pair 정의로 확인할 수 있다. 미래 catalog를 재정렬하면 과거 pairIndex로 현재 정의를 조회하지 않고 저장된 selectedTraits/archetype 및 engineVersion을 사용한다.

설명은 “여러 체계에서 반복된 A를 포함하고, B도 서로 다른 체계에서 함께 나타나 이 유형을 선택했습니다” 정도로 표현할 수 있다. 한쪽만 cross-source이면 양쪽 모두 반복됐다고 쓰지 않는다. 대표 태그를 포함하지 못한 선택·순서 동률은 그 사실을 기록한다. 자신감/확률/정확도 문구는 만들지 않는다. UI 구현은 이번 범위 밖이다.

통합 위치: `analyzeDestiny()`에서 사주·서양 점성·MBTI·혈액형·Tarot와 commonKeywords 계산 후, **기존 buildAnalysisTrace 호출을 선택 앞쪽으로 이동해 한 번만 실행**한다. 패턴 파생과 순수 선택 helper를 호출하고 기존 catalog에서 identityStatement/archetype을 가져온다. 상세 서술·tarotFlow·conflicts·keywordStrengths·merged coreTags 계산은 그대로 둔다. Foundation의 trace가 기존 동작을 구동하지 않는다는 주석은 v2에서 Identity에 한해 사용한다는 범위로 수정해야 한다. 이는 의도적으로 다음 단계에 진입하는 변경이다.

예상 구현 파일: `app/lib/identitySelection.ts`(작은 순수 helper·reason 타입), `app/lib/analysis.ts`(통합·버전·optional 필드), focused selection regression, diagnostic 비교 모드, golden migration 및 관련 회귀 스크립트/문서. 기존 `analysisPatterns.ts`의 후보/수렴 의미 변경은 필요 없다. UI·storage·catalog·Saju 매핑을 새로 작성하지 않는다.

## 7. 버전과 저장·연동 호환성

실제 구현 시 **ANALYSIS_ENGINE_VERSION='2'**, **schemaVersion=2 유지**를 권장한다. 결과 의미 변경은 engineVersion, backward-compatible optional 설명 필드는 현재 schema로 구분 가능하다. `AnalysisTrace.version=1`도 유지한다. 저장의 `kind:'v2'`는 schema 분류이며 engine v2라는 뜻이 아니다.

기존 engine v1 snapshot, trace 없는 schema v2, legacy 모두 원래 값을 보존한다. 열기·공유·재저장에서 선택 함수/trace/reason을 호출하거나 backfill하지 않는다. 새로운 분석만 engine2와 새 ID/시각/선택 설명을 갖는다. storage의 같은 analysisId 저장과 savedId 기반 legacy 재저장 의미는 유지한다.

**출력 변화의 실제 전파를 승인 범위에 명시해야 한다.** `generateDestinyCode()` seed에 archetype이 있으므로 새 Identity는 새 Destiny Code를 만들 수 있다(해시 충돌 때문에 전부 달라진다고 단정하지 않음). 새 share/profile/analytics의 archetype·identityStatement·코드도 그 결과를 따른다. compatibility의 태그 비교 규칙은 변하지 않지만 `personFlow`가 archetype을 삽입하는 경로는 새 profile에서 문구가 바뀔 수 있다. 이를 무조건 “Identity 외 모든 문자열 불변”으로 테스트하면 잘못이다. 기존 저장 profile/공유 payload는 변경하지 않는다. profileStore는 코드 단위 저장이므로 같은 입력을 새로 분석하면 별도 코드/profile이 생길 수 있다는 기존 저장 특성도 유지한다.

현재 Supabase analytics row에는 engineVersion이 없어 운영 자료에서 v1/v2를 완전히 분리할 수 없다. 선택 구현에 DB migration을 섞지 않는다. 이번 합성 진단과 혼합 운영 analytics를 비교해 v2 효과를 주장하지 않으며, 운영 버전별 효과 측정을 시작하려면 별도 버전 태깅 범위를 승인받는다.

## 8. Golden/회귀 이전 및 수용 기준

지금은 golden을 수정하지 않는다. 구현 승인 후 기존 `scripts/golden-baseline.json`을 **바이트 그대로 역사적 v1 fixture로 별도 보존**하고, 7개 동일 입력의 v2 baseline을 별도 생성한다. 허용 diff는 identityStatement/archetype 및 그로부터 파생된 Destiny Code, 신규 선택 설명/버전 메타데이터다. detailedReading·commonKeywords·CoreTags·Saju·conflicts·keywordStrengths·Tarot 결과는 동등해야 한다. v2 전체 결과를 새 캡처해 무검토 승인하지 않는다.

기존 v1 fixture는 역사적 저장 결과 복원·공유·재저장 회귀에 계속 사용한다. 매번 최신 엔진이 v1을 재생성해야 한다는 의미가 아니다. 현재 golden 스크립트는 동일 analyzeDestiny를 호출하므로 엔진을 v2로 바꾼 뒤 옛 baseline 비교를 그대로 PASS시킬 수 없다. 비교 대상/허용 변화 검사를 분리하고 v1 oracle과 v2 기대값을 모두 남긴다. 운영 코드에 v1 엔진 전체를 복제할 필요는 없다.

`regression-analysis-patterns.ts`의 “first authored-pair matches actual archetype”은 명시적 v1 불변식이므로 v2에서만 갱신한다. 첫 후보의 출처/순서 검사는 유지하고 실제 선택은 새 ranking 회귀에서 검증한다. 이를 포함한 관련 테스트 수정은 승인된 의미 변경이며 패턴 의미 자체를 바꾸라는 지시가 아니다.

필수 수용 기준:

- 동일 trace/입력 반복, Evidence·Claim 배열 순서 변경, 동일 source 중복 경로 추가가 선택에 영향을 주지 않는다. 명시적 pairIndex tie-break, no convergence/no pair/single/generic 경로를 검사한다.
- missing Evidence/미입력 MBTI/누락된 달·상승은 근거를 만들지 않는다. zodiac/태양·달·상승은 western source 한 표, 사주 보완도 saju 한 표다. Tarot 제외·기존 후보 범위를 검사한다.
- 대표 태그 포함 후보가 있으면 반드시 그 안에서 선택한다. 동일 anchor 조건에서는 min 증가, 동일 min에서는 union 증가가 우선하고 완전 동률은 authored 순서다. sharedSources 개수에 숨은 점수는 없다.
- 선택 설명의 claimIds는 같은 snapshot trace에 존재하고 available Evidence로 연결된다. sources는 그 연결과 일치하며 pair eligibility/ranking support를 혼동하지 않는다. 새 engine2 결과에는 설명이 있고 과거 결과에는 생성하지 않는다.
- 고정 19,983개 집합에서 위 B의 정확한 건수와 `ed598f84`를 재현한다. pair 중 불일치 **6,899건(34.72418%) 이하**를 현재 후보 범위에서 달성한다. 더 낮으면 숨은 후보/내용 변경이 없는지 검토한다. 이 값은 측정된 구조적 최솟값이며 임의의 품질 점수가 아니다. 실제 convergence 및 포함 가능 후보가 있는 subset의 불일치는 **0건**이어야 한다.
- 분포의 균등화·관측 archetype 수 증가를 합격 조건으로 삼지 않는다. 이번 권장안은 13/21을 유지한다. 두 편 cross-source 8,964건·변경 13,424건은 구현 동일성 검증이지 미래 사용자 성향 비율 목표가 아니다.
- 기존 저장 engine1/trace 없는 schema2/legacy 열기·공유·재저장 결과와 ID/코드 보존. 신규 engine2 snapshot 저장·복원 round-trip 및 중복 저장 검사를 추가한다.
- golden v1 보존 + v2 허용 diff 검토, saved-context·evidence-trace·pattern·selection regression, diagnostic, TypeScript, build, diff-check 통과. 새로운 금지 난수/LLM/network 호출 없음. 상세 서술·기존 태그 기반 compatibility 규칙·UI 구현은 바꾸지 않는다.

## 9. Claude 구현 계획 — 제품 승인 후 최대 3단계

1. 작은 순수 Identity selector와 focused 회귀를 작성한다. 현재 catalog·패턴 범위를 보존하고 위 튜플·fallback·설명 자료형을 구현한다. 고정 입력 비교 diagnostic으로 A/B/v1과 exact counts를 확인한다.
2. analyzeDestiny의 trace 생성을 선택 앞에 연결하고 engineVersion 2 및 optional identitySelection을 추가한다. 신규 결과에만 적용한다. 저장/공유/코드 전파와 역사적 결과 보존을 검사한다.
3. v1 golden을 보존하고 승인된 v2 golden diff를 검토한다. 패턴의 v1 선택 불변식만 의도적으로 이전하고 전체 회귀·TypeScript·build·diff-check를 실행해 CLAUDE_REPORT에 결과를 기록한 뒤 독립 검수를 요청한다. 사용자 승인 없이 merge/push하지 않는다.

**다음 결정:** Option B, 현 catalog·Saju 보완 처리 유지, conflict 제외, 신규 분석 engine2 전환과 그에 따른 Identity/코드 변경 범위를 사용자에게 승인받는다. 승인 전 애플리케이션 구현을 시작하지 않는다.

---

# Phase 2B foundation 재검수 — 2026-09-30

## 최종 판정

**A. Ready for merge**

- BLOCKER: **0** / IMPORTANT: **0** / MINOR: **0** / OBSERVATION: **1**
- 검수 대상: `refactor/pattern-foundation-phase2b`, 수정 커밋 `106ea99`. 이전 구현 `38834e8` 및 main `5758350` 대비 실제 diff를 모두 확인했다.
- 이전 IMPORTANT 1과 MINOR 1은 해소됐다. 병합 전 필수 수정은 없다. 이번 작업은 문서 기록만 수행했으며 merge/push하지 않았다.

## 이전 지적 해소 확인

### IMPORTANT 1 — 입력 생성기: 해결

`mulberry32`는 정수 상태 갱신·비트 연산·`Math.imul`을 사용한다. 기존 부정확한 Number 곱셈에 의한 상태 붕괴 경로가 제거됐으며 `Math.random()`을 사용하지 않는다. 동일 seed의 입력 스트림 일치 및 20만 난수의 `[0, 1)` 범위를 별도로 확인했다. 홀수 증분의 32비트 상태 순환과 현재 표본의 고유성은 종전 짧은 반복이 제거됐다는 근거이며, 난수 출력값 자체가 모두 고유하다는 의미는 아니다.

독립 실행 결과:

| 지표 | 결과 |
| --- | --- |
| 생성 행 / 유효 입력 고유 수 / 중복 | 20,000 / **19,983** / **17** |
| 고유 비율 / digest | **99.91% / `ca1e44df`** |
| 최빈 Identity | 외로운 연결주의자 9,614건, **48.1%** |
| 상위 4개 합계 | 18,417건, **92.1%** |
| 대표 교집합 불일치 | pair 경로 기준 **84.6%** |
| 관측 archetype | **13 / 21** |

17개 중복은 모두 출생시간 미입력 사례였고, 같은 입력의 최대 출현 횟수는 2였다. 날짜·MBTI·혈액형만 남는 작은 부분 공간에서 충돌이 생기는 것은 자연스럽다. 현재 표집 확률로 이 부분 공간의 예상 충돌 쌍은 대략 14개 수준이다. 17개를 또 다른 짧은 순환의 증거로 볼 근거는 없다. 중복률 1% 초과 실패는 현재 표본 수·분포에서 생성기 붕괴를 포착하는 보수적인 무결성 검사로 적절하다. 통계적 품질 인증이나 향후 모든 표집 설정에 통용되는 기준은 아니다.

유효 입력 key는 분석에 전달되는 양력 날짜, UI의 12개 시간 슬롯, 시간이 있을 때만 좌표, MBTI, 혈액형으로 구성된다. ID·순번 등 무관한 메타데이터로 고유성을 늘리지 않는다. 날짜는 사주·별자리 계산, 시간은 사주·서양 점성 계산, 좌표는 시간이 있는 Ascendant 계산, MBTI·혈액형은 기존 태그 매핑 경로에 연결된다. 좌표 목록은 중복 제거된 UI 좌표다. 이는 서로 다른 분석 입력 설정 수이지, 서로 다른 결과 수를 뜻하지 않는다.

성별은 현재 사용하는 사주 반환 필드에 영향을 주지 않고 Tarot는 현재 Identity/commonKeywords의 집계 대상이 아니다. 별도 300건 대조에서 성별만 바꾼 snapshot은 `analysisId`·`createdAt`을 제외하고 동일했고, Tarot만 바꾼 경우 측정 대상 Identity/commonKeywords가 동일했다. Tarot의 다른 서사·trace까지 불변이라는 의미는 아니다. 음력은 기존 `lunarToSolar` 경로를 거쳐 같은 양력 날짜로 해석된다. 유효한 음력 날짜에서 양력으로 변환한 300쌍의 Identity/commonKeywords 일치를 추가 확인했다. 이 진단이 모든 달력 경계값을 검증하는 것은 아니며 달력 구현 변경도 범위 밖이다.

### MINOR 1 — missing Evidence 대조 fixture: 해결

새 fixture는 MBTI의 `체계적`·`감성적`과 blood의 `체계적` claim을 사용한다. available MBTI에서 실제 pair와 양쪽 claim ID/source 및 sharedSources를 확인하고, 같은 claims에서 MBTI만 missing으로 바꾸면 pair가 사라짐을 확인한다. 이어 available Saju의 `감성적` 지지를 추가하면 blood/Saju의 실제 지지만 남고 MBTI claim/source 및 sharedSources가 생기지 않는지 검사한다. 이전의 한쪽 trait 자체가 없던 자명한 검사가 아니다. 기존 1개를 4개로 대체했으며 개별 assertion **74개**를 독립 계수했다.

## 범위 및 기존 동작 보존

- `38834e8..106ea99`는 진단·패턴 회귀 스크립트와 문서만 변경한다. `app/` 변경은 없다.
- main 대비 애플리케이션 변경은 이전 검수 대상인 readonly 정의 export와 독립 `analysisPatterns.ts`뿐이다. production 분석·UI·저장 경로에서 패턴을 소비하도록 연결하지 않았다.
- Identity 알고리즘·정의·pair 순서, convergence/authored-pair 의미, conflicts, Saju, snapshot schema, engineVersion, narrative, UI에 수정 커밋으로 인한 변화가 없다. 기존 사용자 출력·저장 의미 보존에 대한 이전 검수 결론을 유지한다.
- golden baseline은 변경하지 않았으며 재생성하지 않았다. Identity Selection v2, Palm, Pattern Engine, Relationship Engine 구현을 추가하지 않았다.

## 독립 검증

| 검사 | 결과 |
| --- | --- |
| `npx -y tsx scripts/golden-analysis.ts` | PASS, 7건 |
| `npx -y tsx scripts/regression-saved-context.ts` | PASS |
| `npx -y tsx scripts/regression-evidence-trace.ts` | PASS |
| `npx -y tsx scripts/regression-analysis-patterns.ts` | PASS, 개별 74 assertions |
| `npx -y tsx scripts/diagnostic-identity-diversity.ts` | PASS, 두 실행 digest 일치 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false -p .` | PASS |
| `npm run build` | PASS |
| `git diff --check main...HEAD` / `git diff --check` | PASS |

## OBSERVATION 1 — 수치의 적용 범위

스크립트는 합성 입력에 대한 구조 진단이며 실제 사용자 모집단 추정이나 다양성 합격 기준이 아니라고 명시한다. 다만 “uniformly”는 전체 UI 입력 조합에 대한 균등 분포로 읽으면 정확하지 않다. 날짜 범위는 1950–2009이고 시간·좌표·MBTI의 유무에 지정 확률이 있는 혼합 표집이다. 기존 진단 대비 시간·날짜·좌표 표집 방식과 digest 대상도 달라졌으므로 새 수치를 생성기 수정만의 효과로 해석하지 않는다. 향후 비교는 이번 표집 설정과 key/digest 정의를 고정해 수행한다. 병합 필수 수정은 아니다.

## 다음 단계

Phase 2B foundation은 병합 준비가 됐다. 별도 승인하에 병합한 뒤 **Identity Selection v2 설계 단계**로 진입할 수 있다. 목표는 실제 cross-source intersection/provenance의 대표성을 높이는 것이며 archetype 빈도를 인위적으로 균등화하는 것이 아니다. 이번 검수는 해당 설계나 출력 변경을 승인·구현하지 않는다.

---

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
