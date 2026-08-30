# Documentation Directory

This directory currently contains a legacy flat collection of maintainer references. It is being prepared for a later documentation restructuring; the files have not yet been moved because their accuracy and ownership boundaries must be audited first.

## Intended structure

| Location | Audience | Published on the documentation website |
|---|---|---|
| `docs/user/` | Plugin users | Yes — canonical English source |
| `docs/development/` | Contributors and maintainers | No |
| `docs/architecture/` | Contributors and maintainers | No |
| `.agents/` | Coding agents and automation | No |
| `.agent-work/` | Local task state and unresolved research | Never committed |

All files committed to this repository are public even when they are not rendered on the website. Confidential notes and secrets do not belong anywhere in this repository.

## Current files awaiting classification

| File | Current role | Likely destination |
|---|---|---|
| `ATTACHMENT-HANDLING.md` | Maintainer implementation reference | `architecture/` |
| `CHATGPT-2026-FORMAT.md` | Provider export-format research | `architecture/providers/` |
| `IMPORT-WORKFLOW.md` | Import pipeline architecture | `architecture/` |
| `LINK-UPDATE-SYSTEM.md` | Subsystem architecture | `architecture/` |
| `ZIP-PIPELINE.md` | ZIP pipeline architecture | `architecture/` |
| `adding-a-provider.md` | Contributor implementation guide | `development/` |
| `ISSUE-WORKFLOW.md` | Maintainer collaboration workflow | `development/` |
| `RELEASE-WORKFLOW.md` | Maintainer release workflow | `development/` |

These destinations are provisional. Before moving a file, verify its claims against the implementation and decide whether it should be split, merged, updated, archived, or removed.

## Editorial boundaries

- `README.md` explains the repository: purpose, essential installation, project links, support, license, credits, and a short guide to the documentation available in this repository.
- User documentation is task-oriented and organized for navigation and search. It must not mirror the code architecture.
- Provider-specific behavior belongs under that provider. Behavior shared by all providers has one canonical explanation in the common documentation.
- Maintainer documentation may describe internals, fixtures, pipelines, release procedures, and collaboration practices, but is not copied to the public user site.
- Do not duplicate a fact to make a page self-contained. Give the minimum context needed and link to the canonical page.

## Accuracy requirements

Treat the current README and documentation as material to review, not as guaranteed truth. For every user-facing claim, prefer observable tests and current code. Record facts that cannot be confirmed in `.agent-work/uncertainties.md` so the maintainer can resolve them.
