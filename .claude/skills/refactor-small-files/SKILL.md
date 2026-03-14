---
name: refactor-small-files
description: Refactor code to meet file-size limits and DRY rules without changing behavior.
disable-model-invocation: true
---

# Refactor Small Files

Enforce file size limits: UI ≤150 LOC, hooks/utils ≤200, handlers/services ≤250, orchestration ≤350.

## Steps

1. Identify files exceeding limits in the target area.
2. For each oversized file:
   - Extract focused modules by responsibility (UI vs state vs service vs types).
   - Prefer extraction over rewriting.
   - Keep public APIs stable — update imports cleanly.
3. Check for DRY violations (logic appearing 2+ times).
4. Run `/verify` to confirm no regressions.

## Output

- Files split (old → new) with line counts
- What was extracted and why
- Verification results
