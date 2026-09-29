# Palm Phase 1A — Observation Contract + Evidence Adapter

Status: PALM PHASE 1A — IMPLEMENTED / AWAITING CODEX REVIEW

Palm 아키텍처 설계(Codex 판정 A, 커밋 `f2db08c`)의 **P1-A만** 구현했다. 브랜치는 `refactor/palm-observation-phase1a`(from main `f2db08c`)이며, 병합·push하지 않았다.

- 신규 파일: `app/lib/palmObservation.ts`(관찰 계약), `app/lib/palmEvidence.ts`(순수 adapter), `scripts/regression-palm-evidence.ts`
- PalmObservationBundle → EvidenceRecord[]만 구현했다. 이미지·provider·API·UI·Claim·CoreTag 매핑·`analyzeDestiny`/trace 통합·저장은 **없음**.
- engine `'3'`, schema `2`, trace `1` 모두 그대로다. 운영 출력 변경 0이며, golden v1/v2/v3과 진단 digest(`25ab43b8`/`dab19aab`)가 그대로다.

상세 결과는 `CLAUDE_REPORT.md` 상단에 있다.

## 다음 단계

Codex가 `git diff main...refactor/palm-observation-phase1a`로 P1-A를 검수한다. P1-B(서버 추출) 이후 단계는 설계 문서의 구현 전 검토 절차를 따르며 이번에 시작하지 않았다.

---

## 이전 기록: Palm Phase 1 아키텍처 설계

# Palm Phase 1 — Architecture Design

Status: PALM PHASE 1 — ARCHITECTURE DESIGN

**설계 검토 완료 / 구현 미시작 / 구현 범위 승인 대기.**

기준 production main `70bc9da`, engineVersion `'3'`, schemaVersion `2`. Identity Catalog v3는 완료·병합되었으며 최적화를 재개하지 않는다.

## 현재 설계 결과

- 판정 **A. EXISTING ARCHITECTURE CAN ACCEPT PALM WITH SMALL EXTENSIONS**.
- 이미지 → 별도 품질/관찰 → 순수 Evidence adapter → 추후 승인된 symbolic Claim → 기존 패턴/Identity 순서를 유지한다.
- 관찰 전용 도입과 실제 합성 활성화는 분리한다. `palm` source 추가만으로 합성되지 않으며 target allowlist와 commonKeywords를 함께 맞춰야 한다.
- 원본 이미지는 일시 처리만 하고 저장하지 않는다. 새 snapshot에 optional 구조화 관찰/trace만 보존하며 과거 결과 backfill은 없다.
- 기존 엔진·schema·catalog·golden은 이번 설계에서 변경하지 않았다.

## 다음 단계

상세 타입, source counting, 서버/provider 경계, 보안·저장 정책 및 단계별 검증은 `CODEX_REVIEW.md` 최상단에 있다.

사용자 설계 확인 후 첫 구현은 **P1-A 관찰 계약·순수 Evidence adapter**만 제안한다. 예상 파일은 `app/lib/palmObservation.ts`, `app/lib/palmEvidence.ts`, `scripts/regression-palm-evidence.ts`와 단계 보고 문서다. API/provider/UI/snapshot 통합/Claim/합성/버전 변경은 이 첫 구현에 포함하지 않는다. 아직 구현을 시작하지 않았다.

이후 순서는 서버 관찰 추출 → 선택적 관찰 UI·저장 → 별도 제품 승인된 상징 규칙·합성 활성화다. 마지막 단계 전에는 기존 분석 결과가 바뀌지 않아야 한다.

---

## 이전 단계 기록 (원문 보존)

# Identity Catalog v3 — Implementation

Status: IDENTITY CATALOG V3 — COMPLETED / MERGED

사용자가 Identity Catalog Pair Revision(Option A)을 **제품 승인**했다. Claude Code가 브랜치 `refactor/identity-catalog-v3`(from main `74a039a`)에 구현했고, Codex 최종 검수(**A — READY FOR MERGE**, BLOCKER/IMPORTANT/MINOR/OBSERVATION 0/0/0/0, 검수 커밋 `ac578ab`) 후 `main`에 fast-forward로 병합했다. 수동 배포는 하지 않았다.

## 승인된 제품 결정

- Pair: **창의적 + 독립적**
- Identity 이름: **고집스러운 실험가**
- 결과 문장(정확히): "주어진 방식을 따르기보다 자기 방법을 새로 만들지만, 이미 잘 돌아가는 것까지 다시 손대는 사람입니다."
- 이전 제안 "정답 밖의 설계자"('납득할 수 있는 답' 중심 문장)는 **승인되지 않았다**.

## 구현 요약

- catalog 끝(pairIndex **10**)에 추가했다. 기존 pairIndex 0–9는 유지된다. Option B 선택 규칙·대표 convergence·provenance·패턴 로직은 변경하지 않았다(파일 blob이 main과 동일).
- `ANALYSIS_ENGINE_VERSION = '3'`, `schemaVersion = 2`. 엔진별 catalog 범위는 `IDENTITY_PAIR_COUNT_BY_ENGINE`에 기록한다(v1 10, v2 10, v3 11).
- 기존 v1·v2 저장 결과는 동결되어 있다. 재선택·backfill을 하지 않는다.
- golden: v1·v2 기준 파일은 그대로(blob 동일), 신규 `golden-baseline.v3.json`을 추가했다.
- 진단(고유 19,983): 불일치 34.72%→**17.57%**, v2→v3 Identity 변경 **6,188건(30.97%)**, 관측 유형 **10/22**, single→pair **115**, 신규 불일치 **20**. 설계 기대값과 정확히 일치한다.

상세 결과는 `CLAUDE_REPORT.md` 상단에 있다.

### 완료 (병합)

- **승인된 Identity:** 창의적 + 독립적 → **고집스러운 실험가** — "주어진 방식을 따르기보다 자기 방법을 새로 만들지만, 이미 잘 돌아가는 것까지 다시 손대는 사람입니다." (pairIndex 10)
- `ANALYSIS_ENGINE_VERSION = '3'`, `schemaVersion = 2`. 기존 v1·v2 저장 결과는 동결되어 있고, golden v1·v2는 그대로 보존했으며 v3 기준을 추가했다.
- 병합 전후 검증:
  - golden v1/v2/v3(엄격한 v2→v3 허용 변경 포함), saved-context, evidence-trace: PASS
  - Pattern 74 / Identity v2 97 / Identity v3 23: PASS
  - TypeScript, build, diff-check: 통과
- **v3 진단(고유 19,983):**
  - 불일치 3,512 / **17.57%** (v2 34.72%)
  - v2→v3 Identity 변경 6,188 / **30.97%**(전부 고집스러운 실험가)
  - single→pair 115, 신규 불일치 20, 관측 유형 10/22
- **v3 digests:** selection `25ab43b8`, full `dab19aab`. 과거 digest: v1 `94fe72c7`, v2 `ed598f84` / `93a95fcd`.

## Next

**NEXT PRODUCT REVIEW:** Identity Catalog / Narrative evolution, 또는 다음에 승인되는 Destiny Code phase. 아직 정의하거나 시작하지 않았다.

---

## 이전 기록: Identity Catalog Pair Revision 설계 검토

# Identity Catalog Pair Revision — Design Review

Status: IDENTITY CATALOG PAIR REVISION — DESIGN REVIEW COMPLETE / AWAITING PRODUCT APPROVAL

기준 production main `74a039a`, engineVersion `2`, schemaVersion `2`. Identity Selection v2는 완료 상태이며 재설계하지 않는다.

## 권장안

Option A: **창의적+독립적 신규 authored pair 1개만** 기존 catalog 끝에 추가하는 설계다. 기존 21개는 유지하여 정의 22개·고유 pair 10개가 된다. 아직 catalog를 수정하지 않았다.

- 이름 후보: **고집 있는 실험가 / 자기 길의 편집자 / 남의 답이 불편한 사람**. 제품 검토용이며 미확정이다.
- 개념: 새로운 방법을 실험하면서 그 방법의 결정권도 스스로 갖고 싶어 하는 패턴.
- 합성 진단 예상: mismatch 34.72%→17.57%, Identity 변경 6,188건(30.97%), 기존 불일치 3,407건 해소, 신규 불일치 20건.
- 관측 archetype은 13/21→10/22로 줄고 single 115건이 pair로 전환된다. 이 부작용을 승인 없이 숨기거나 selector로 보정하지 않는다.
- 중복 안전한 탐험가와 도달 불가 single 6개는 유지한다. 나머지 top5 pair는 보류한다.
- 창의적 편중은 적은 catalog 이웃과 넓은 upstream 매핑이 함께 기여한다. 매핑이 의미적으로 부적절하다는 결론은 이번 측정으로 입증되지 않았다.

## 다음 단계

사용자가 개념·이름·최종 문구와 전환 부작용을 승인한 뒤에만 구현한다. 승인되면 engineVersion `3`, schemaVersion `2` 유지, 과거 v1/v2 저장 및 golden 보존, 별도 v3 golden 검토가 필요하다. 아직 구현 승인 상태가 아니다.

상세 21개 개념 지도, 5개 pair 의미 분석, A/B/C/D 실측, 재사용/중복/single 검토, 서사 시제품과 이전 전략은 `CODEX_REVIEW.md` 최상단에 있다. 기존 회귀·TypeScript·build·diff-check와 두 생산 digest 유지 검증이 통과했다. 이번 작업은 문서 두 개와 /tmp 임시 측정뿐이며 생산 코드·catalog·버전·golden은 변경하지 않았다.

---

## 이전 단계 이력

# Identity Catalog Coverage Analysis

Status: IDENTITY CATALOG COVERAGE ANALYSIS — COMPLETE / AWAITING PRODUCT DECISION

기준 main `74a039a`, engineVersion `2`, schemaVersion `2`. Identity Selection v2는 구현·검수·병합 완료 상태이며 이번 조사에서 재설계하지 않았다.

## 분석 결과

- 고유 19,983건에서 mismatch 6,899/19,868 pair = 34.72%다.
- 상호 배타적 원인: catalog 호환 조합 부재 4,569(66.23%), candidate/provenance 범위 차이 2,317(33.58%), no-convergence fallback 13(0.19%). 유효 대표 후보가 순위에서 밀린 사례는 0이다.
- 분석 분류 **A. Catalog coverage is the primary remaining limitation**.
- raw demand top1/3/5 pair의 임시 추가 시 mismatch는 17.57% / 12.19% / 4.87%다. 분모·새 불일치·기존 정합 결과 변경이 있으므로 content 추가 승인으로 해석하지 않는다.
- 13/21 관측은 중복 shadowing 1개, 현재 매핑/pair-first에서 도달하지 못하는 single 6개, 정상 입력에서 도달하지 않는 generic 1개로 설명된다.
- 원래 선택과 golden은 보존됐고 모든 요청된 검증이 통과했다. 상세 근거·표·반사실 조건과 이전 이력은 `CODEX_REVIEW.md`에 있다.

## 다음 제품 결정

권장 단일 다음 단계는 **Identity Catalog Pair Revision — DESIGN**이다. 의미적 일관성과 서사의 구별 가능성을 실제 coverage 수요와 함께 평가한다. 새 pair 추가·catalog 수정·selector 변경은 아직 승인하거나 구현하지 않았다.

이번 조사에서는 문서 두 개만 변경했다. 임시 스크립트는 /tmp에 두었고 production·engineVersion·golden 변경 및 merge/push는 없다. 수치는 합성 엔진 구조 진단이며 실제 사용자 분포 추정이 아니다.

---

## 이전 단계 이력

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
