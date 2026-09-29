# Phase 2B — Foundation (observational)

Status: PHASE 2B FOUNDATION IMPLEMENTED — IDENTITY CHANGE NOT APPROVED

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

사용자는 Phase 2B 중 **사용자에게 보이지 않는 기반 작업**만 승인했다. Claude Code가 브랜치 `refactor/pattern-foundation-phase2b`에 구현했다. 병합·push는 하지 않았다.

- 다양성 기준선 진단: `scripts/diagnostic-identity-diversity.ts`
- 관찰용 패턴 파생: `app/lib/analysisPatterns.ts` (`convergence` / `authored-pair`)
- 결과와 검증: `CLAUDE_REPORT.md`

Identity 선택 알고리즘은 의도적으로 변경하지 않았다. Phase 2B의 제품 변경(Identity 개선)은 완료가 아니며 승인되지 않았다.

다음 단계:

1. Codex가 기반 작업을 독립 검수한다. 검수 기준은 `git diff main...refactor/pattern-foundation-phase2b`, `CLAUDE_REPORT.md`의 검증 명령, 예비 분석(`CODEX_REVIEW.md` 상단)이다.
2. 사용자가 Identity 선택 변경 여부와 규칙을 결정한다. 이는 의도된 출력 변경이므로 엔진 버전 증가와 golden 명시적 재설정이 필요하다.
