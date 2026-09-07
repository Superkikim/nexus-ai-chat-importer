---
name: review-deliverable
description: Independently review substantial code, documentation, plans, or release artifacts in this repository for correctness, omissions, UX problems, duplication, and unsupported claims.
---

# Review Deliverable

Act as an independent reviewer. Read `AGENTS.md`, the task brief, and the changed artifacts. Do not rely on the producing agent's conclusions. Review is read-only unless the user explicitly asks to fix findings.

## Review method

- Reconstruct the intended outcome and acceptance criteria from primary task artifacts.
- Inspect the actual diff and relevant surrounding files.
- Verify technical claims against tests and implementation rather than documentation alone.
- Look for omitted cases, contradictions, regressions, ambiguous user journeys, duplicate canonical facts, broken links, and accidental scope expansion.
- Confirm that attribution, Git, privacy, and publication rules in `AGENTS.md` were followed.
- Run safe, relevant checks when they materially strengthen the review.

Classify findings as:

- **Blocker**: wrong, unsafe, materially incomplete, or cannot meet the stated outcome.
- **Major**: likely to mislead users or create substantial maintenance cost.
- **Minor**: real improvement that does not block use.
- **Uncertainty**: cannot be decided from available evidence; state what was inspected and what a human must decide.

For every finding, identify the affected file or behavior, explain the impact, and cite concrete evidence. Do not invent findings to fill categories. If no findings remain, say so and state the residual risks and checks not run.

Store substantial review output in `.agent-work/review-findings.md` when the task already uses local working state. Never stage or commit that directory.
