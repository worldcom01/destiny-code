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
