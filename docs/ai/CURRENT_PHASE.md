# Identity Selection v2 — Implementation

Status: IDENTITY SELECTION V2 — COMPLETED / MERGED

사용자가 Codex Option B를 승인했다. 이는 **의도된 사용자 출력 변경**이다. Claude Code가 브랜치 `refactor/identity-selection-v2`(from main `2746b5e`)에 구현했고, Codex 최종 검수(A) 후 `main`에 fast-forward로 병합했다.

## 구현 요약

- **순위:** (대표 convergence 태그 포함, 양쪽 중 작은 distinct-source 수, 양쪽 source 합집합 크기) 사전식 내림차순. 동률은 기존 authored 순서다. convergence가 없으면 v1 선택을 유지한다.
- **버전:** `ANALYSIS_ENGINE_VERSION = '2'`, `schemaVersion = 2` 유지. 새 분석에는 `identitySelection`(선택 이유)이 기록되고, 과거 저장 결과는 재계산하지 않는다.
- **Golden:** v1 기준은 `golden-baseline.v1.json`(바이트 동일)으로 보존했다. v2 기준을 신규로 추가했고, v1 대비 허용 diff는 Identity 문구·archetype·Destiny Code다. 7개 케이스 중 3개가 바뀌었다.
- **진단** (고유 19,983): 불일치 84.60%→34.72%, 양쪽 교차 출처 22.60%→45.12%, Identity 변경 67.18%, selection digest `ed598f84`. Codex 설계 측정과 정확히 일치한다.
- **유지:** catalog 21개(중복·도달 불가 포함), CoreTag, 사주 보완 의미, conflictEngine 미사용, 서술·UI.

상세 결과는 `CLAUDE_REPORT.md`, 설계는 `CODEX_REVIEW.md` 상단에 있다.

## 다음 단계

Codex가 `75fd9c5`를 main `2746b5e` 대비 최종 독립 검수했다. 판정은 **A. Ready for merge**, BLOCKER / IMPORTANT / MINOR / OBSERVATION 모두 **0**이다.

- Option B 구현·v1 저장 보존·버전·golden 이전이 적합하다.
- 전체 요청 검증이 통과했다(pattern 74, Identity 97 assertions). 고유 19,983건과 digest `ed598f84` / `93a95fcd`를 재현했다.
- 실제 main 엔진과 고유 입력 전건 차등 비교에서 승인 밖 snapshot 변경 및 기존 패턴 변경은 0건이다. 수렴 없는 15건도 v1 Identity를 유지했다.
- 상세 최종 검수와 이전 설계 이력은 `CODEX_REVIEW.md`에 보존했다.

다음 단계는 **사용자 승인 후 main 병합 및 검증**이다. 이번 검수에서는 문서 두 개만 수정했으며 애플리케이션·golden 변경, commit/merge/push를 하지 않았다.

### 완료 (병합)

- Option B를 구현했다. 순위는 (대표 convergence 포함, min distinct-source, source 합집합)이고, 동률은 authored 순서, convergence가 없으면 v1이다.
- `ANALYSIS_ENGINE_VERSION = '2'`, `schemaVersion = 2`.
- 기존 v1 저장 결과는 동결되어 있다. 조회·공유·재저장 시 재계산하거나 backfill하지 않는다.
- v1 golden 이력은 `scripts/golden-baseline.v1.json`(main 시절과 같은 blob `d79d1fa`)으로 보존했다. v2 기준은 `scripts/golden-baseline.v2.json`이다.
- 병합 전후 검증:
  - golden 이전 검사(7개 중 3개 Identity 변경, 허용 범위 밖 변경 0), saved-context, evidence-trace, pattern 74, Identity v2 97: PASS
  - 진단(고유 19,983): 불일치 84.60%→34.72%, 양쪽 교차 출처 22.60%→45.12%, Identity 변경 67.18%, selection digest `ed598f84`, 전체 진단 digest `93a95fcd`
  - TypeScript, build, diff-check: 통과
- Identity catalog(21개, 중복 #8=#3, 도달 불가 '안전한 탐험가' 포함), CoreTag, 사주 보완 의미, conflict 미사용은 그대로다.

## Next

다음 작업은 Identity 선택 규칙의 추가 수정이 **아니다**.

다음 조사는 **Identity Catalog Coverage Analysis**다. 남은 대표 교집합 불일치 34.72% 중 얼마가 선택 알고리즘이 아니라 기존 21개 authored Identity catalog의 한계(대표 태그를 포함하는 쌍이 catalog에 없음 등)에서 오는지 판단하는 것이 목적이다. 아직 시작하지 않았다.

---

## 이전 Phase 2B 완료 기록

# Phase 2B — Foundation (observational)

Status: PHASE 2B FOUNDATION — COMPLETED / MERGED

Identity Selection v2 is NOT implemented. Next phase: **Identity Selection v2 DESIGN** (not started).

Previous phase: Phase 2A — Evidence Traceability is complete and merged (`main` `5758350`).

## Objective

Understand what the current engine actually means by "intersection", identify the structural causes of results that feel too similar, and determine the smallest useful abstraction on top of the Phase 2A trace.

Only the observational foundation (diversity baseline + derived patterns) is approved. Any change to user-visible output, including Identity selection, still requires approval.

## Out of scope

- Pattern Engine / Relationship Engine
- Palm
- LLM interpretation, embeddings, vector DB, graph DB
- probabilistic scoring, new confidence model
- new trait ontology
- user feedback learning
- UI changes
- any change to user-visible analysis output without explicit approval

## Constraints

- Existing golden baseline stays unchanged unless an approved phase intentionally changes output (then: engine version bump + explicit baseline reset with reviewed diff).
- Saved historical results are never reinterpreted (AD-002).
- Cross-source convergence of symbolic mappings is not empirical validation (AD-004).

## Current next action

Codex가 `refactor/pattern-foundation-phase2b`의 수정 커밋 `106ea99`를 이전 구현 `38834e8` 및 main `5758350` 대비 독립 재검수했다. 최종 판정은 **A. Ready for merge**다.

- 이전 IMPORTANT 1(생성기 반복)과 MINOR 1(missing Evidence fixture)이 모두 해소됐다. BLOCKER 0 / IMPORTANT 0 / MINOR 0 / OBSERVATION 1이다.
- 20,000행 중 고유 유효 입력 **19,983개**, 중복 17개, digest **`ca1e44df`**를 재현했다. 합성 표집 수치는 실제 사용자 모집단의 빈도 추정이 아니다.
- golden·saved-context·evidence-trace·pattern(개별 74 assertions)·diversity diagnostic·TypeScript·build·diff-check가 통과했다. golden baseline과 기존 사용자 출력·저장 의미는 보존됐다.
- 상세 재검수와 이전 C 판정 이력은 `CODEX_REVIEW.md`에 보존했다.

다음 단계는 사용자 승인에 따른 foundation 병합이다. 이번 재검수에서는 merge/push하지 않았다. 이후 별도 Identity Selection v2 설계에 진입할 준비가 됐다. 실제 Identity 선택·사용자 출력 변경은 여전히 별도 승인 사항이며 이번 검수에서 설계하거나 구현하지 않았다. 목표는 cross-source intersection/provenance의 대표성 개선이며 archetype 빈도의 인위적 균등화가 아니다.

### 완료 (병합)

Codex 재검수(A) 후 `refactor/pattern-foundation-phase2b`를 `main`에 fast-forward로 병합했다. 병합 전후 검증 결과는 다음과 같다.

- golden, saved-context, evidence-trace, pattern(74 assertions): 모두 PASS
- diversity diagnostic: 20,000 / 고유 19,983 / digest `ca1e44df`
- TypeScript, build, diff-check: 통과

Phase 2B **foundation**만 완료되었다. 완료된 것은 관찰용 패턴 파생과 다양성 기준선이다. Identity 선택 알고리즘, 사용자 출력, `ANALYSIS_ENGINE_VERSION`, golden baseline, AnalysisSnapshot 구조는 변경되지 않았다.

다음 단계는 **Identity Selection v2 DESIGN**이다. 설계는 아직 시작하지 않았다. 실제 Identity 변경은 설계 검토와 사용자 승인 뒤, 엔진 버전 증가와 golden 명시적 재설정을 거쳐서만 진행한다.
