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


## AD-007 — Palm Phase 1C는 기본 분석과 분리된 보조 해석

2026-09-30 사용자 로드맵 변경에 따른 결정. PalmObservation → 결정적 상징적 해석 → 기존 결과와 보조 비교 → UI로 연결한다. Palm Evidence/Claim을 기존 trace/CoreTags/convergence/Identity에 넣지 않는다. engine '3'과 snapshot schema 2는 유지하고 Palm supplement와 해석 규칙을 별도 버전 관리한다. snapshot analysisId/legacy savedId에 연결한 보조 기록을 별도 저장하며 과거 결과를 자동 재해석하지 않는다.

## AD-008 — Palm 서비스 처리와 개선용 원본 수집은 별개

Phase 1C는 서비스 제공을 위한 외부 AI 처리 안내를 제공하고 원본 사진을 앱 저장소/로그/analytics에 보관하지 않는다. 개선 목적 보관 동의를 이용 동작에서 추정하지 않는다. 원본 연구 수집과 활성 opt-in은 private storage·보관 기간·철회/삭제 경로가 준비될 때까지 보류한다. 로컬의 명시적 파생 결과 저장과 제한된 서버 비용 통제 metadata는 목적/보관 범위를 구분한다.

## AD-009 — 공개 Palm 호출은 서버 공통 비용 제한을 통과해야 함

운영자 secret을 browser에 배포하지 않는다. 익명 session·same-origin/CSRF 보호와 여러 instance에 걸친 atomic 한도/중복 제어를 사용한다. 관련 설정·공통 저장소가 준비되지 않으면 공개 기능을 비활성화한다. 기존 in-memory gate만으로 공개 유료 endpoint를 운영하지 않는다. CV 실험 모델/runtime은 Phase 1C production에 연결하지 않는다.
