# Release workflow

The end-to-end process for releasing a new plugin version, from the end of
development to publication on the Obsidian Community Plugin registry.

Releases are **semi-automated**: the quality checks, documentation, version bump,
and merge are manual; a single tag push triggers the automated build and GitHub
Release.

| Step | Who |
|---|---|
| Pre-release quality gate | Manual |
| Documentation updates | Manual |
| Version bump | Manual |
| Merge dev → master | Manual (explicit authorization required) |
| Tag + push | Manual (explicit authorization required) |
| Build, attest, publish GitHub Release | GitHub Actions |
| Obsidian registry pickup | Obsidian, automatic (timing not controlled by this project — historically about a day) |

---

## Phase 1 — Development

All work for a release happens on a `dev-X.Y.Z` branch, with granular commits (one
logical change per commit) using the standard prefixes: `feat:`, `fix:`, `chore:`,
`docs:`, `refactor:`.

---

## Phase 2 — Pre-release quality gate

Run the full gate from [`AGENTS.md`](../../AGENTS.md) on a clean branch:

```bash
npm run type-check
npm run test:run
npx eslint src/
npm run build
npm run check:docs-links
```

> CI (`ci.yml`) runs **only `npm run build`** on branch pushes and pull requests —
> no tests, type-check, lint, or docs-link check. The local gate above is the only
> safety net before release.

---

## Phase 3 — Documentation

Update, before the version-bump commit:

### `RELEASE_NOTES.md`

Add a new section **at the top**, above the previous version:

```markdown
## Version X.Y.Z — <Short title>

![Version](https://img.shields.io/badge/version-X.Y.Z-blue)

### ✨ New
- ...

### 🔧 Improved
- ...

### 🐛 Fixed
- ...

---
```

Omit empty sections. `release.yml` extracts this section verbatim as the GitHub
Release body.

### `README.md`

Keep the README concise (see [`docs/README.md`](../README.md) for its role). Update
only the one-line "latest version" pointer if the README carries one; do **not**
grow a per-release "What's New" section in the README — `RELEASE_NOTES.md` is the
canonical changelog and the README links to the GitHub releases page.

### Locale fallback (all 10 files)

Update `upgrade.complete_modal.fallback_content` in every
[`src/i18n/locales/*.json`](../../src/i18n/locales/). This text is shown in the
upgrade dialog when the GitHub README cannot be fetched. `{{version}}` is filled at
runtime.

---

## Phase 4 — Version bump

| File | Field |
|---|---|
| `package.json` | `version` |
| `manifest.json` | `version` |

`versions.json` maps the new version to its `minAppVersion` — add a row.
Commit: `chore(release): bump version to X.Y.Z`. Also update the **Current
Version** line in [`CLAUDE.md`](../../CLAUDE.md).

---

## Phase 5 — Merge to master

> **Authorization required.** Never merge, tag, or release without explicit
> sign-off from the maintainer. Each step is a separate gate.

Merge with a merge commit (no squash — preserve the granular history):

```bash
git checkout master
git merge dev-X.Y.Z
git push
```

---

## Phase 6 — Tag and push

Tag on `master` with the **bare** semantic version (no `v` prefix):

```bash
git tag X.Y.Z
git push origin X.Y.Z
```

This push is the sole trigger for `release.yml`. `ci.yml` ignores all tags.

---

## Phase 7 — GitHub Actions (automatic)

`release.yml` fires on a tag matching `[0-9]+.[0-9]+.[0-9]+`:

1. Checkout at the tagged commit.
2. `npm ci --legacy-peer-deps`.
3. `npm run build` → `dist/main.js`, `dist/manifest.json`, `dist/styles.css`.
4. Attest build provenance (`actions/attest-build-provenance`).
5. Extract the `## Version X.Y.Z` section from `RELEASE_NOTES.md` as the release body.
6. Create the GitHub Release (`softprops/action-gh-release`): hand-written body on
   top, auto-generated "What's Changed" commit list below, three assets attached.

---

## Phase 8 — Post-release

For each issue addressed, follow the [Issue workflow](issue-workflow.md): swap the
status label to `status: released`, add `fixed` for bugs, and close.

The Obsidian registry monitors GitHub releases and picks up the new version with no
manual action.

---

## Files touched at every release

| File | Change |
|---|---|
| `RELEASE_NOTES.md` | New version section at top |
| `src/i18n/locales/*.json` (×10) | `upgrade.complete_modal.fallback_content` |
| `package.json`, `manifest.json` | `version` |
| `versions.json` | New version → `minAppVersion` row |
| `CLAUDE.md` | Current Version line |
| `README.md` | Only if it carries a "latest version" pointer |
