# Destiny Code

Persistent technical context shared by the AI coding agents working on this repository (ChatGPT, Codex, Claude Code). Read this first, then `CURRENT_PHASE.md`.

## Product

Destiny Code combines multiple interpretive sources:

- Saju
- MBTI
- Blood type
- Western astrology
- Tarot

The core product concept is not simply displaying separate readings. The goal is to identify intersections, tensions, and recurring patterns across sources and produce a memorable identity interpretation.

Long-term conceptual direction:

```
Source Input
→ Evidence
→ Interpretation
→ Pattern
→ Identity
→ Narrative
```

This is a direction, NOT a mandate to implement all layers now.

## Engineering principles

- Prefer incremental changes.
- Preserve existing behavior unless a phase explicitly changes it.
- Avoid premature abstraction.
- Avoid large rewrites.
- Golden regression behavior is important.
- Saved historical analyses must retain their historical meaning.
- Do not silently reinterpret legacy results.
- Separate observation/calculation quality from interpretation validity.
- User agreement with an interpretation is feedback, not objective validation.

## AI roles

**ChatGPT**
- product/architecture coordination
- evaluates tradeoffs
- defines phase objectives
- reviews agent reports with the user

**Codex**
- architecture review
- code review
- difficult integration analysis
- independent second-pass verification
- should normally avoid implementation unless explicitly requested

**Claude Code**
- scoped implementation
- repository changes
- tests and validation
- implementation reports

**User**
- product owner
- approves meaningful product/architecture decisions
- should NOT need to manually relay long technical reports between agents

## Workflow

1. ChatGPT/user define the phase objective.
2. `CURRENT_PHASE.md` records the active objective.
3. Codex reads the repository + `docs/ai/` context.
4. Codex writes its detailed review to `CODEX_REVIEW.md`.
5. Claude reads `CURRENT_PHASE.md` + `CODEX_REVIEW.md`.
6. Claude implements the approved scope.
7. Claude writes `CLAUDE_REPORT.md`.
8. Codex may perform a final focused review.
9. User approves major decisions and merge/deployment.

The user should normally only need to send short status messages such as:

- "Codex review complete."
- "Claude implementation complete."
- "Final review complete."

Detailed technical state lives in these repository documents, not in chat. `CODEX_REVIEW.md` and `CLAUDE_REPORT.md` are overwritten for each phase; git history keeps earlier versions. Durable decisions go in `DECISIONS.md`.

## Current architecture milestone

Phase 1 is complete.

Phase 1 introduced:

- versioned `AnalysisSnapshot`
- centralized completed analysis assembly (`analyzeDestiny()`)
- `conflicts` / `keywordStrengths` / `coreTags` in the snapshot
- stable saved-result restoration
- active saved-result metadata handling (`app/lib/activeAnalysis.ts`)
- correct Destiny Code restoration
- legacy/v2 distinction in saved results
- golden regression testing
- saved-context regression testing

Current main includes the completed Phase 1 implementation.

Do not reopen Phase 1 unless a concrete regression/blocker is discovered.

## Validation commands

```
npx -y tsx scripts/golden-analysis.ts                   # golden: v1 + v2 allowed-diff, exact v3 (must PASS)
npx -y tsx scripts/regression-saved-context.ts          # saved-context regression (must PASS)
npx -y tsx scripts/regression-evidence-trace.ts         # evidence trace (must PASS)
npx -y tsx scripts/regression-analysis-patterns.ts      # derived patterns (must PASS)
npx -y tsx scripts/regression-identity-selection.ts     # Identity Selection v2 rules (must PASS)
npx -y tsx scripts/regression-identity-catalog-v3.ts    # Identity catalog v3 (must PASS)
npx -y tsx scripts/diagnostic-identity-diversity.ts     # characterization + v1/v2/v3 comparison (fails only on integrity errors)
npx tsc --noEmit -p .
npm run build
npm run lint                                             # 9 pre-existing findings; do not add new ones
git diff --check
```

Never regenerate a golden baseline to make a diff pass. `scripts/golden-baseline.v1.json` (engine v1) and `scripts/golden-baseline.v2.json` (engine v2) are frozen historical baselines and are never rewritten; `scripts/golden-baseline.v3.json` is the current engine v3 baseline. An unexpected golden difference is a finding to report.
