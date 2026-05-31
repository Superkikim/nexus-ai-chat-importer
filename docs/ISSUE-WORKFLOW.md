# Issue Management Workflow

This document defines the conventions for triaging, labeling, and tracking issues in this repository.

---

## Title Convention

```
[TYPE] Scope: short description — symptom if bug
```

**Examples:**
- `[BUG] ChatGPT: export now packages attachments as .dat files — import fails`
- `[FEAT] New Provider: Mistral Le Chat`
- `[CHORE] CI: upgrade actions to Node.js 24`
- `[DOC] README: add screenshots to "See It In Action" section`

| Prefix | When to use |
|---|---|
| `[BUG]` | Incorrect behavior, regression, crash |
| `[FEAT]` | New feature request |
| `[CHORE]` | Maintenance, refactor, quality work — no user-visible change |
| `[ARCH]` | Architectural decision or significant restructuring |
| `[DOC]` | Documentation only |

---

## Labels — Reference Table

### Type

| Label | When to use |
|---|---|
| `bug` | Incorrect behavior |
| `enhancement` | New feature or user-facing improvement |
| `chore` | Maintenance / refactor |
| `documentation` | Documentation only |
| `css` | CSS / styles related |
| `provider` | Related to an AI provider (ChatGPT, Claude, …) |
| `locale` | Translation / i18n |
| `duplicate` | Duplicate of an existing issue |
| `wontfix` | Will not be addressed |
| `good first issue` | Suitable for new contributors |
| `help wanted` | External contributions welcome |
| `urgent` | Blocking or critical — requires immediate attention |

### Status (lifecycle)

| Label | Meaning |
|---|---|
| `status: evaluation in progress` | Under analysis — feasibility to be confirmed |
| `status: pending user insight` | Blocked — waiting for information from the reporter |
| `status: in progress` | Actively being worked on |
| `status: suspended` | Paused — external dependency or deprioritized |
| `status: released` | Shipped in a published release |
| `fixed` | Bug confirmed fixed (use alongside `status: released`) |
| `fixed-in-dev` | Fixed in a branch, not yet released |
| `pending-release` | Ready, waiting for the next release cycle |
| `partially-implemented` | Partially addressed — follow-up needed |

### Target

| Label | Meaning |
|---|---|
| `target: X.Y.Z` | Planned for release version X.Y.Z |

---

## Workflow by Issue Type

### Bug

1. **Triage** → apply `bug` + `status: evaluation in progress`
2. **Information missing** → switch status to `status: pending user insight`, post a comment tagging the reporter with specific questions
3. **Information received** → switch to `status: in progress`, assign to a branch, add `target: X.Y.Z`
4. **Fix merged to dev branch** → add `fixed-in-dev`, keep `target: X.Y.Z`
5. **Released** → switch to `status: released` + `fixed`, close the issue

### Feature / Enhancement

1. **Triage** → apply `enhancement` + `status: evaluation in progress`
2. **Accepted** → switch to `status: in progress` + `target: X.Y.Z`
3. **Shipped** → switch to `status: released`, close the issue
4. **Rejected** → apply `wontfix`, close with a short explanation

### Chore / Arch / Doc

1. Apply `chore` (or `documentation`) + `status: evaluation in progress`
2. When started → `status: in progress`
3. When done → `status: released`, close the issue

---

## Notes

- Always remove the previous status label before applying a new one — an issue should have exactly one `status:` label at any time.
- Use `target: X.Y.Z` as soon as a version is decided. Update it if the target changes.
- When blocking on a reporter's response, tag them directly in the comment (`@username`) so they receive a notification.
