# Phase 2B — Foundation (observational)

Status: PHASE 2B FOUNDATION — CODEX FINDINGS FIXED, AWAITING RE-REVIEW

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

Codex가 `refactor/pattern-foundation-phase2b`의 `38834e8`을 main `5758350`과 비교해 독립 검수했다. 판정은 **C. Revision required**다. 상세 검수는 `CODEX_REVIEW.md` 최상단에 있으며 과거 예비 분석·Phase 2A 기록은 보존했다.

- IMPORTANT 1: 다양성 진단 20,000행에서 고유 입력은 1,409개다. LCG의 Number 곱셈 정밀도에 따른 짧은 반복을 수정하고 입력 고유성 검증 및 진단 수치·digest를 갱신한다. golden baseline은 변경하지 않는다.
- MINOR 1: missing Evidence의 authored-pair fixture가 실제로 한쪽 지지 누락을 시험하도록 available 대조를 추가한다.
- 기존 사용자 출력·저장 의미는 보존되고 golden·saved-context·evidence-trace·pattern·TypeScript·build는 통과했다. convergence의 source dedupe와 authored-pair 출처 구조는 현재 정의에 적합하다.

다음 단계는 Claude의 위 두 범위 수정 후 Codex 재검수다. 현재 병합·push하지 않는다. Identity 선택 변경은 여전히 별도 승인 사항이며, 진단 기준선 보완 후 제품 규칙을 논의한다. archetype 비율의 인위적 균등화는 목표가 아니다.

### 수정 반영 (Claude Code)

Claude가 같은 브랜치에 두 지적을 새 커밋으로 수정했다. `38834e8`은 amend하지 않았다. 상세 내용은 `CLAUDE_REPORT.md` 상단의 "Codex 지적 반영"에 있다.

- **IMPORTANT 1:** 생성기를 `mulberry32`로 교체하고 유효 입력 기준의 고유성을 보고하도록 했다. 결과는 20,000행, 고유 19,983개, 중복 17개(99.91%)다. 중복률이 1%를 넘으면 무결성 오류가 난다. 새 digest는 `ca1e44df`이며, 이전 수치는 이력으로 남겼다.
- **MINOR 1:** available/missing 대조 fixture로 authored-pair provenance를 검사한다. 버그는 없었고, 패턴 회귀 개별 assertion은 74개다.
- 애플리케이션 코드, Identity, 패턴 의미, Snapshot, golden은 변경하지 않았다.

다음 단계는 Codex 재검수다. 병합·push하지 않는다. Identity 선택 변경은 여전히 별도 승인 사항이다.
