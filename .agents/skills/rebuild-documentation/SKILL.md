---
name: rebuild-documentation
description: Design, audit, or rebuild this repository's user documentation and README using the current code as evidence, with UX, DRY, navigation, and uncertainty tracking as acceptance criteria.
---

# Rebuild Documentation

Read `AGENTS.md` and `docs/README.md` before acting. This skill governs the English source documentation in this repository. Do not modify the sibling website or translations unless the user explicitly includes them.

## Establish durable task state

For a substantial audit or rebuild, create `.agent-work/` and maintain:

- `inventory.md`: existing source material and code areas inspected.
- `documentation-map.md`: proposed hierarchy, page purpose, audience, and canonical ownership.
- `coverage-matrix.md`: page status, evidence inspected, and review state.
- `uncertainties.md`: contradictions, unverified claims, and questions for the maintainer.
- `review-findings.md`: independent review findings and their resolution.

These files are local working state. Never stage or commit them.

## Work from evidence

Use the source hierarchy in `AGENTS.md`. Start from the existing README and docs to discover topics, then verify behavior in implementation, types, settings, locale strings, tests, and fixtures. For each page, make it possible to identify which evidence was inspected.

When evidence is insufficient:

- omit unsupported claims from public documentation;
- record the missing fact and searched locations in `uncertainties.md`;
- continue with unrelated work;
- ask the maintainer only when the answer changes the information architecture or makes the page unsafe or materially misleading.

## Design for users

Build navigation around user intent rather than source-code modules. Separate common behavior, provider-specific behavior, and independent tools. Prefer progressively disclosed pages over large catch-all pages, while avoiding pages too small to answer a real question.

Every page must have:

- a clear user question or task;
- an explicit scope and suitable navigation label;
- one canonical owner for each fact it explains;
- links to prerequisites and logical next steps where useful;
- provider and platform limitations placed where users will look for them;
- examples verified against current behavior.

Keep common procedures canonical. Provider pages add only provider-specific export steps, supported data, attachment behavior, limitations, and troubleshooting, with links back to common workflows.

## Execute in controlled passes

1. Inventory the README, current docs, code areas, settings, locale keys, tests, and relevant fixtures.
2. Produce the information architecture and canonical-ownership map before writing pages.
3. Write or revise one page at a time and update the coverage matrix immediately.
4. Run a technical review with fresh context against code and tests.
5. Run a separate UX and DRY review across page boundaries and navigation.
6. Correct supported findings, recording unresolved ones without concealing them.
7. Rewrite the repository README after the documentation structure is stable. Preserve maintainer-curated credits and make the roles of the public user docs and maintainer docs clear.
8. Run relevant link, Markdown, navigation, and build checks. Report skipped checks.

Parallel writers may own disjoint pages after the documentation map is stable. They must not define competing versions of common facts. The coordinating agent owns cross-page consistency and final reconciliation.

## Completion criteria

Do not declare completion until:

- every planned page has evidence and review status in the coverage matrix;
- no known blocking technical or navigation finding remains open;
- repeated facts have one canonical owner;
- all unresolved questions are listed with enough evidence for human resolution;
- README, navigation, and documentation boundaries agree;
- validations and their results are reported;
- every staged file has been checked for public suitability;
- validated work is committed and pushed according to `AGENTS.md`, without attribution trailers.
