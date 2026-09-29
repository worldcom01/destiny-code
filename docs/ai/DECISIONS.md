# Architecture Decisions

Durable architecture/product decisions only. Phase-specific plans belong in `CURRENT_PHASE.md`.

## AD-001 — Incremental engine evolution

Destiny Code will evolve incrementally from the existing CoreTag engine rather than replacing it with a new engine in one rewrite.

## AD-002 — AnalysisSnapshot

AnalysisSnapshot is the reproducible representation of a completed analysis.

Historical saved analyses should not be silently reinterpreted by newer engine behavior.

## AD-003 — Evidence traceability before Pattern Engine

EvidenceRecord and InterpretationClaim traceability will be introduced before implementing a new Pattern/Relationship engine.

## AD-004 — Confidence semantics

Observation quality, calculation correctness, interpretation validity, and user agreement are distinct concepts.

They must not be collapsed into one generic confidence score.

## AD-005 — Palm

Palm analysis may later become an additional evidence source.

Palm observation/image quality must remain separate from symbolic personality interpretation validity.

## AD-006 — Identity catalog changes are engine versions

The Identity catalog is part of the interpretation engine. Adding or changing an authored Identity bumps `ANALYSIS_ENGINE_VERSION` (schemaVersion stays unless the stored shape changes). Catalog entries are appended so existing `pairIndex` values keep their meaning; each engine's catalog prefix is recorded in `IDENTITY_PAIR_COUNT_BY_ENGINE`. Saved results keep the Identity they were created with and are never re-selected with a newer catalog. Each engine version keeps its own golden baseline.

Engine v3 (2026-09-30, product-approved): 창의적 + 독립적 → **고집스러운 실험가** — "주어진 방식을 따르기보다 자기 방법을 새로 만들지만, 이미 잘 돌아가는 것까지 다시 손대는 사람입니다." The earlier proposal "정답 밖의 설계자" (centered on "납득할 수 있는 답") was **not** approved.
