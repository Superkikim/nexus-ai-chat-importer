# Release Workflow

This document defines the end-to-end process for releasing a new version of the plugin, from the end of development to publication on the Obsidian Community Plugin registry.

---

## Overview

Releases are **semi-automated**. Most of the work is manual (quality checks, documentation, version bump, merge), and a single git tag push triggers the automated build and GitHub Release creation.

| Step | Who/What |
|---|---|
| Pre-release checklist (tests, lint, build) | Manual |
| Documentation updates | Manual |
| Version bump | Manual |
| Merge dev → master | Manual |
| Tag + push | Manual |
| Build, attest, publish GitHub Release | GitHub Actions (automatic) |
| Obsidian registry pickup | Obsidian (automatic, within 24h) |

---

## Phase 1 — Development

All work for a release happens on a dedicated branch:

```
dev-X.Y.Z
```

Follow granular commit discipline: one logical change per commit, using the standard prefixes from CLAUDE.md:

| Prefix | When |
|---|---|
| `feat:` | New user-facing feature |
| `fix:` | Bug fix |
| `chore:` | Maintenance, dependency, config |
| `docs:` | Documentation only |
| `refactor:` | Internal restructuring, no behavior change |

---

## Phase 2 — Pre-release quality checks

Before touching any version number or docs, verify the branch is clean.

```bash
npm run test:run           # All tests must pass
npx eslint src/            # Zero errors
npm run build              # Build must succeed
```

> CI runs on branch pushes but does **not** run tests — only builds. Local quality gates are the only safety net before release.

---

## Phase 3 — Documentation

Update three areas **before** the version bump commit:

### RELEASE_NOTES.md

Add a new section **at the top** of the file, above the previous version:

```markdown
## Version X.Y.Z — <Short Title>

![Version](https://img.shields.io/badge/version-X.Y.Z-blue) ![Patch](https://img.shields.io/badge/type-patch-orange)

### ✨ New
- ...

### 🔧 Improved
- ...

### 🐛 Fixed
- ...

---
```

Omit sections that have no entries. This content is automatically extracted and used as the GitHub Release body when the tag is pushed.

### README.md

Two locations:

1. **Headline callout** (near the top, below the badge row):
   ```markdown
   > ✅ **vX.Y.Z** — One-line summary of the main change(s).
   > See [What's New](#-whats-new) for details.
   ```

2. **What's New section** — add a `### vX.Y.Z — <Title>` subsection above the previous version with the key changes (condensed version of RELEASE_NOTES.md).

### Locale files (all 10)

Update `upgrade.complete_modal.fallback_content` in every locale file:

```
src/i18n/locales/en.json
src/i18n/locales/fr.json
src/i18n/locales/de.json
src/i18n/locales/es.json
src/i18n/locales/it.json
src/i18n/locales/ja.json
src/i18n/locales/ko.json
src/i18n/locales/pt.json
src/i18n/locales/ru.json
src/i18n/locales/zh.json
```

This fallback is shown in the upgrade dialog when the GitHub README cannot be fetched (offline, tag not yet published). Provide the content in each language. The `{{version}}` template variable is filled automatically at runtime.

---

## Phase 4 — Version bump

Edit both files to the new version number:

| File | Field |
|---|---|
| `package.json` | `"version": "X.Y.Z"` |
| `manifest.json` | `"version": "X.Y.Z"` |

Commit:
```
chore(release): bump version to X.Y.Z
```

> Also update the `## Project Overview` → **Current Version** line in `CLAUDE.md`.

---

## Phase 5 — Merge to master

Merge the dev branch into `master` with a **merge commit** (no squash — preserve the granular history):

```bash
git checkout master
git merge dev-X.Y.Z
git push
```

> **Authorization required**: Never merge, tag, or release without explicit sign-off from the developer. Each step is a separate gate.

---

## Phase 6 — Tag and push

Create the tag on `master` using the **bare semantic version** — no `v` prefix:

```bash
git tag X.Y.Z
git push origin X.Y.Z
```

**This push is the sole trigger for the release pipeline.** The CI workflow (`ci.yml`) explicitly ignores all tags; only `release.yml` responds to them.

---

## Phase 7 — GitHub Actions (automatic)

`release.yml` fires on every tag matching `X.Y.Z`:

1. **Checkout** — at the tagged commit
2. **Install** — `npm ci --legacy-peer-deps`
3. **Build** — `npm run build` → produces `dist/main.js`, `dist/manifest.json`, `dist/styles.css`
4. **Attest build provenance** — SLSA attestation via `actions/attest-build-provenance`
5. **Extract release body** — Python script pulls the `## Version X.Y.Z` section from `RELEASE_NOTES.md`
6. **Create GitHub Release** — body from RELEASE_NOTES.md + auto-generated "What's Changed" commit list appended below; assets uploaded

The GitHub Release page shows:
- **Description** (top): the hand-crafted `RELEASE_NOTES.md` section
- **What's Changed** (below): auto-generated list of commits since the previous tag

---

## Phase 8 — Post-release: issue hygiene

For each issue addressed in this release, follow the [Issue Workflow](ISSUE-WORKFLOW.md):

- Remove `status: in progress`, `fixed-in-dev`, or `pending-release`
- Add `status: released` + `fixed`
- Close the issue

---

## Obsidian Registry

The Obsidian Community Plugin registry monitors GitHub releases automatically. Once the GitHub Release is published, the new version typically appears in the Obsidian plugin browser within **24 hours** with no manual action required.

---

## Files modified at every release

| File | What changes |
|---|---|
| `RELEASE_NOTES.md` | New version section added at top |
| `README.md` | Headline callout + What's New section updated |
| `src/i18n/locales/*.json` (×10) | `upgrade.complete_modal.fallback_content` updated |
| `package.json` | `version` field bumped |
| `manifest.json` | `version` field bumped |
| `CLAUDE.md` | Current Version line updated |
