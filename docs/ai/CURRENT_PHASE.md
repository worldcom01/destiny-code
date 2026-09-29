# Phase 2B — PRELIMINARY DESIGN REVIEW

Status: PRELIMINARY DESIGN REVIEW — NOT APPROVED, NOT READY TO IMPLEMENT

Previous phase: Phase 2A — Evidence Traceability is complete and merged (`main` `5758350`).

## Objective

Understand what the current engine actually means by "intersection", identify the structural causes of results that feel too similar, and determine the smallest useful abstraction on top of the Phase 2A trace.

This phase is analysis/design only until approved.

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

Claude Code가 Codex 일시 부재로 **예비** 아키텍처 분석을 `CODEX_REVIEW.md` 상단 "Phase 2B Preliminary Architecture Analysis — Claude Code"에 기록했다. 승인된 설계가 아니다.

다음 단계:

1. Codex가 예비 분석을 독립 검토한다. 특히 측정 수치, 결과 유사성 원인 분류, `PatternRecord` 최소안(`convergence` / `authored-pair`)의 필요성을 확인한다.
2. 사용자가 제품 결정을 내린다. 결정할 것은 두 가지다.
   - Identity 선택 규칙을 바꿀지(의도된 출력 변경)
   - 사주 보완 오행 태그의 의미, 그리고 "교차 신호" 섹션의 검증처럼 들리는 문구를 어떻게 다룰지
3. 승인 후에만 구현 명세를 확정한다. 예비안의 첫 두 단계는 사용자에게 보이는 출력을 바꾸지 않는다.
