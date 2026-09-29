# Claude Implementation Report

Status: IDENTITY SELECTION V2 — IMPLEMENTED, AWAITING CODEX REVIEW

Branch `refactor/identity-selection-v2` (from main `2746b5e`). Not merged, not pushed. 이전 Phase 2B foundation 보고는 git history(`2746b5e`)에 있다.

사용자가 Codex **Option B**를 승인했다. 이는 **의도된 사용자 출력 변경**이다. 구현은 `CODEX_REVIEW.md` 상단 "Identity Selection v2 — 설계 검토"의 규칙·자료형·통합 지점·golden 이전 방식을 따른다.

## Implemented Scope

1. **순수 선택 함수** `app/lib/identitySelection.ts` — `selectIdentityV2(input) → IdentitySelectionReason`
   - 입력은 새 분석의 trace, 기존 catalog(인자로 전달, 복제 없음), `commonKeywords[0]`의 태그, 사주 첫 태그다.
   - **대표 태그 R:** 실제 convergence가 있을 때만 `commonKeywords[0]`를 쓴다. R이 최대 source 수의 convergence가 아니면 오류를 던진다(잘못된 통합을 v1로 조용히 대체하지 않음).
   - **후보:** 기존 authored-pair 패턴 그대로다(사주·zodiac·혈액형·MBTI 범위). 달·상승궁·타로는 후보를 만들지 않는다.
   - **순위 지지 S(t):** convergence 범위(달·상승 포함, 타로 제외)의 available Claim에서 센 distinct source 집합이다. 새 공용 함수 `traitSupportInConvergenceScope()`로 계산하며, 기존 convergence 계산에서 추출한 것이라 로직이 중복되지 않는다.
   - **순위 튜플** (사전식 내림차순): `(R 포함 ? 1 : 0, min(|S(A)|, |S(B)|), |S(A) ∪ S(B)|)`. 동률이면 `pairIndex` 오름차순이다. 명시적 비교 루프를 쓰며 sort 안정성에 기대지 않는다. 가중치·점수는 없다.
   - **convergence가 없을 때:** 첫 authored 후보를 고른다(`no-convergence-pair`). 후보도 없으면 v1과 같은 single(`commonKeywords[0]` → 사주 첫 태그), 그다음 generic이다.
   - `usedAuthoredOrder`는 최고 튜플이 동률이거나 no-convergence pair일 때 true다.
2. **통합** `app/lib/analysis.ts`
   - `ANALYSIS_ENGINE_VERSION = '2'`로 올리고 `schemaVersion: 2`는 유지했다.
   - `AnalysisSnapshot.identitySelection?: IdentitySelectionReason`을 추가했다. 새 분석에는 항상 기록되고, 과거 결과에는 재계산하지 않는다.
   - `buildAnalysisTrace()`를 Identity 선택 앞으로 옮겼다. 실행은 여전히 한 번이다.
   - `identityFromSelection()`은 유일한 catalog(`CONFLICT_IDENTITY`/`SINGLE_IDENTITY`)에서 문구를 가져온다. generic 문구는 `GENERIC_IDENTITY` 하나로 공유한다.
   - v1 선택(`generateIdentityV1`)은 그대로 보존하고, 비교·진단·회귀용으로 `identityV1(result)`를 export했다.
   - trace와 패턴의 "Identity를 구동하지 않는다"는 주석은 v2 범위(Identity 선택에만 사용)로 고쳤다.
3. **Golden 이전** `scripts/golden-analysis.ts`
   - `golden-baseline.json` → **`golden-baseline.v1.json`**(`git mv`, blob `d79d1fa`로 main과 동일, 다시 쓰지 않음).
   - 신규 **`golden-baseline.v2.json`**은 `--capture-v2`로 만들며, v1 비교가 실패하면 캡처를 거부한다.
   - v1 비교에서 허용되는 차이는 `identityStatement`, `archetype`, `destinyCode`(archetype이 seed)뿐이다. 나머지 필드는 모두 같아야 한다. `identityV1()`이 역사적 v1 archetype을 재현하는지도 확인한다.
4. **회귀·진단**
   - 신규 `scripts/regression-identity-selection.ts`.
   - `regression-analysis-patterns.ts`의 v1 불변식("첫 authored-pair = 실제 archetype")을 "= `identityV1()`"로 옮겼다(Codex §8).
   - `diagnostic-identity-diversity.ts`에 v1 vs v2 비교(고유 입력 기준)를 추가했다. 무결성 검사도 두 가지 추가했다.
     - convergence가 없으면 v2 = v1
     - R을 포함하는 후보가 있으면 반드시 R 포함 쌍을 선택
5. **문서:** `PROJECT_CONTEXT.md`의 검증 명령 목록을 새 golden 파일명과 새 회귀 스크립트로 갱신했다.

변경하지 않은 것:
- Identity catalog 21개(텍스트·쌍·순서·중복 #8=#3·도달 불가 '안전한 탐험가'). catalog digest `2a85c50`으로 확인했다.
- CoreTag 어휘·매핑, 사주 보완 의미(source `saju` 한 표), conflictEngine(선택에 미사용)
- 교집합·keywordStrengths·서술 템플릿·tarotFlow
- UI, storage 분류, schemaVersion, trace 형식, 과거 저장 결과

## Files Changed

| 파일 | 변경 |
| --- | --- |
| `app/lib/identitySelection.ts` | 신규 — 순수 v2 선택 + `IdentitySelectionReason` |
| `app/lib/analysis.ts` | 엔진 버전 2, `identitySelection?`, trace 선행, v2 연결, `identityV1` 보존·export |
| `app/lib/analysisPatterns.ts` | `traitSupportInConvergenceScope()` 추출(convergence 의미 불변), 주석 |
| `app/lib/evidenceTrace.ts` | 주석 1줄 |
| `scripts/golden-analysis.ts` | v1 허용 diff + v2 정확 비교 |
| `scripts/golden-baseline.v1.json` | 이름만 변경(바이트 동일) |
| `scripts/golden-baseline.v2.json` | 신규 v2 기준 |
| `scripts/regression-identity-selection.ts` | 신규 |
| `scripts/regression-analysis-patterns.ts` | v1 불변식을 `identityV1`로 이전 |
| `scripts/diagnostic-identity-diversity.ts` | v1/v2 비교 + 무결성 검사 2개 |
| `docs/ai/*` | 보고·상태·검증 명령 |

## Validation

### Golden (7 cases)

v1 기준 대비 허용 필드 외 변경은 0건이다. Identity가 바뀐 케이스는 **3/7**이다.

| 케이스 | v1 → v2 | 선택 근거 |
| --- | --- | --- |
| solar, full input, Seoul | 감정을 분석하는 사람 → **틀 안의 반항자** | ranked, 대표 체계적, authored order(#3/#8 동률) |
| solar, no time, no place | 군중 속의 고독자 = | ranked, 대표 창의적 |
| solar, no MBTI | 군중 속의 고독자 = | ranked, 대표 창의적 |
| lunar, regular month | 틀 안의 반항자 = | ranked, 대표 분석적(포함 후보 없음), authored order |
| lunar, leap month | 감정을 분석하는 사람 → **분주한 포용자** | ranked, 대표 포용적 |
| ISFP + fire sign + A | 감정을 분석하는 사람 = | ranked, 대표 실용적(포함 후보 없음), authored order |
| water sign, B + SJ | 외로운 연결주의자 → **의심하는 직관가** | ranked, 대표 직관적 |

### Diagnostic — engine v1 vs v2

고유 유효 입력 19,983개를 각각 한 번씩 평가했다(생성 20,000행, 중복 17). 합성 균등 표본이며 실제 사용자 분포가 아니다.

| 지표 | v1 | v2 | Codex 설계 측정 (B) |
| --- | --- | --- | --- |
| observed archetypes | 13/21 | 13/21 | 13/21 |
| top 1 | 48.08% | 23.68% | 23.68% |
| top 4 | 92.08% | 66.89% | 66.89% |
| intersection mismatch (pair 분모) | 84.60% (16,808/19,868) | 34.72% (6,899/19,868) | 34.72% (6,899) |
| both-sides cross-source (pair 분모) | 22.60% (4,490) | 45.12% (8,964) | 45.12% (8,964) |
| authored order used (전체 분모) | 99.42% | 36.60% (7,314) | 36.60% (7,314) |
| Identity changed from v1 | — | 67.18% (13,424/19,983) | 67.18% (13,424) |
| selection digest | `94fe72c7` | **`ed598f84`** | `ed598f84` |

- 설계 측정과 **건수와 digest가 정확히 일치**한다. 알고리즘을 수치에 맞추는 조정은 하지 않았다.
- 20,000행 기준 진단 digest는 `ca1e44df`(engine v1) → **`93a95fcd`**(engine v2)다. 정의가 다르므로 selection digest와 혼용하지 않는다.
- 무결성 검사 두 가지 모두 오류 0이다: "no-convergence 경로 = v1", "R 포함 후보가 있으면 R 포함 쌍 선택".

### Identity v2 regression (`PASS`, 개별 assertion 97개)

요청된 15개 항목을 모두 검사한다.

| # | 검사 내용 |
| --- | --- |
| 1 | 결정성 |
| 2 | R 포함 후보가 앞선 강한 쌍을 이김 |
| 3 | min 우선 |
| 4 | union 우선 |
| 5 | authored 순서 동률 해소와 `usedAuthoredOrder` |
| 6 | no-convergence / single / 사주 fallback / generic = v1 |
| 7·9 | 사주 지배+보완 경로가 1 source |
| 8 | zodiac+태양이 1 source, 태양+달이 1 source |
| 10 | missing Evidence는 근거를 만들지 않음 |
| 11 | 타로 무영향(fixture, 실제 카드 교체) |
| 12 | engine-v1 저장본은 그대로 로드되고, 코드도 저장된 v1 archetype 기준이며, 재저장해도 바이트 동일 |
| 13·14 | 새 분석은 engineVersion '2' / schemaVersion 2, 저장 round-trip, 중복 저장 안전 |
| 15 | catalog digest 불변 |

추가 검사:
- **min과 union이 다른 답을 낼 때 min 우선.** "합집합 우선" 변이를 잡기 위해 추가했다. 처음에는 이 변이가 통과해서 보강했다.
- Moon-only 태그는 후보 불가, 대표 태그 불변식 위반 시 오류
- 실제 분석 8건:
  - archetype이 catalog 항목과 일치
  - reason의 claimIds가 같은 trace의 available Evidence에 연결되고, source와 일치
  - Evidence·Claim 배열을 뒤집어도 선택이 같음

**Mutation check:** 튜플 순서를 (R, union, min)로 바꾸거나 R 항목을 제거하면 각각 FAIL한다. 복구 후 PASS다.

## Build / Test / Lint

```
npx -y tsx scripts/golden-analysis.ts                 # PASS: golden v1→v2 migration checks (7 cases)
npx -y tsx scripts/regression-saved-context.ts        # PASS
npx -y tsx scripts/regression-evidence-trace.ts       # PASS
npx -y tsx scripts/regression-analysis-patterns.ts    # PASS (74)
npx -y tsx scripts/regression-identity-selection.ts   # PASS (97)
npx -y tsx scripts/diagnostic-identity-diversity.ts   # OK (무결성 오류 0)
npx tsc --noEmit -p .                                 # OK
npm run build                                         # OK
npm run lint                                          # 기존 9건과 동일 (신규 0)
git diff --check                                      # OK
```

## Deviations From Codex Design

없음. 명세가 정하지 않은 세부는 다음과 같다.

1. **single 경로의 reason:** `support`에 선택 태그 하나의 convergence 범위 지지를 넣었다. 명세 "single이면 선택된 한 태그"대로다.
2. **대표 태그 불변식 위반:** 선택 함수가 `Error`를 던진다. 새 분석에서는 발생하지 않는다. 교집합과 convergence가 같은 계산 규칙이며, 19,983건 진단에서 0건이다.
3. **순위 계산 공용 함수:** `traitSupportInConvergenceScope()`를 `analysisPatterns.ts`에서 export했다. 기존 convergence는 이 함수를 그대로 사용하며, 패턴 회귀 74개는 변경 없이 PASS다(v1 불변식 이전 1건 제외).

## Remaining Issues

- **예상된 사용자 영향:** 새 분석의 결과 화면 Identity(약 67%)와 그에 따른 Destiny Code, 프로필·analytics의 archetype/identityStatement, 궁합 문구 중 archetype 삽입 부분(`compatibilityEngine.ts` personFlow)이 바뀐다. 공유 문구(`shareEngine.ts`)에는 archetype이 없어 바뀌지 않는다. 모두 승인 범위다. 기존 저장 결과는 바뀌지 않는다.
- **대표 교집합 불일치 34.72%:** 현재 후보 범위와 catalog에서 도달할 수 있는 최솟값이다. 더 낮추려면 catalog나 후보 범위를 바꾸는 별도 제품 결정이 필요하다.
- **analytics 버전 구분:** Supabase analytics row에 engineVersion이 없어 운영 데이터에서 v1/v2를 구분할 수 없다. 범위 밖이며 별도 승인 사항이다.
- **catalog 정리:** 중복 쌍 #8, 도달 불가 archetype은 별도 제품 결정이다.

## Final Status

IDENTITY SELECTION V2 — IMPLEMENTED, AWAITING CODEX REVIEW
