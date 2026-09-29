# Identity Selection v2 — Design Review

Status: IDENTITY SELECTION V2 — DESIGN REVIEW COMPLETE / AWAITING PRODUCT APPROVAL

검토 기준: `main` `2746b5e`. Phase 2B foundation은 병합 완료됐다. Identity Selection v2는 **설계 검토만 완료**, 구현하지 않았다.

## 권장 설계

- 대표 convergence 태그 포함 → 양쪽 중 작은 distinct-source 수 → 양쪽 source 합집합 크기 → 기존 authored 순서의 결정적 비교(Option B).
- 후보 자격·catalog·CoreTag 매핑을 유지한다. 랭킹 근거는 기존 convergence 범위이며 후보 근거와 구분한다.
- Saju missing-element 보완은 현행대로 saju 한 표로 유지한다. conflicts는 선택에 사용하지 않는다.
- 새 분석만 engineVersion `2`, schemaVersion `2` 유지 및 optional 선택 설명 기록. 과거 저장 결과 재계산/backfill 금지.

## 측정과 승인 상태

19,983개 고유 합성 입력에서 대표 교집합 불일치(pair 분모)는 84.60%→34.72%, 양쪽 cross-source 지지는 22.60%→45.12%, Identity 변경은 67.18%다. 관측 archetype은 13/21로 같다. 실제 사용자 분포 추정이나 균등 분포 목표가 아니다.

상세 비교·정확한 알고리즘·설명 타입·버전/golden 이전·수용 기준·최대 3단계 구현 계획은 `CODEX_REVIEW.md` 최상단에 있다. 설계 근거는 구현 준비에 충분하나, 신규 사용자 Identity와 파생 Destiny Code 변경이므로 **제품 승인 후 Claude가 구현**한다. 아직 구현/출시 승인으로 표시하지 않는다.

## 다음 단계와 범위

사용자가 Option B 및 출력 변경 범위를 승인하면 명세에 따라 구현한다. 현재 작업은 문서와 임시 설계 측정뿐이다. 애플리케이션·golden·engineVersion 변경 없음. Palm, Relationship Engine, 새 UI, LLM 선택, catalog 재작성, 보완 의미 재해석은 범위 밖이다. merge/push하지 않았다.

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
