# Issue workflow

Conventions for triaging, labeling, and tracking issues in this repository.

> The label and lifecycle names below are the **intended** set. If the GitHub
> repository's actual labels have drifted, reconcile them with this page (or update
> this page) rather than inventing new ones ad hoc.

---

## Title convention

```
[TYPE] Scope: short description — symptom if bug
```

**Examples:**
- `[BUG] ChatGPT: export now packages attachments as .dat files — import fails`
- `[FEAT] New provider: Mistral Vibe`
- `[CHORE] CI: upgrade actions to Node.js 24`
- `[DOC] README: add screenshots to "See it in action" section`

| Prefix | When to use |
|---|---|
| `[BUG]` | Incorrect behavior, regression, crash |
| `[FEAT]` | New feature request |
| `[CHORE]` | Maintenance, refactor, quality work — no user-visible change |
| `[ARCH]` | Architectural decision or significant restructuring |
| `[DOC]` | Documentation only |

---

## Labels — reference

### Type

| Label | When to use |
|---|---|
| `bug` | Incorrect behavior |
| `enhancement` | New feature or user-facing improvement |
| `chore` | Maintenance / refactor |
| `documentation` | Documentation only |
| `css` | CSS / styles related |
| `provider` | Related to an AI provider (ChatGPT, Claude, Mistral Vibe, Perplexity) |
| `locale` | Translation / i18n |
| `duplicate` | Duplicate of an existing issue |
| `wontfix` | Bug acknowledged but will not be corrected |
| `wontimplement` | Feature request evaluated and deliberately rejected |
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
| `status: pending release` | Done on the dev branch (feature or fix); ships with the `target: X.Y.Z` release |
| `status: released` | Shipped in a published release |
| `fixed` | Bug confirmed fixed (use alongside `status: released`) |
| `partially-implemented` | Partially addressed — follow-up needed |

### Target

| Label | Meaning |
|---|---|
| `target: X.Y.Z` | Planned for release version X.Y.Z |

---

## Workflow by issue type

### Bug

1. **Triage** → `bug` + `status: evaluation in progress`
2. **Information missing** → `status: pending user insight`, comment tagging the reporter with specific questions
3. **Information received** → `status: in progress`, assign to a branch, add `target: X.Y.Z`
4. **Fix done on the dev branch** → `status: pending release`, keep `target: X.Y.Z`,
   comment what changed, close
5. **Released** → `status: released` + `fixed`

### Feature / enhancement

1. **Triage** → `enhancement` + `status: evaluation in progress`
2. **Accepted** → `status: in progress` + `target: X.Y.Z`
3. **Done on the dev branch** → `status: pending release`, keep `target: X.Y.Z`,
   comment what shipped, close
4. **Released** → `status: released`
5. **Rejected** → `wontimplement`, close with a short explanation

### Chore / arch / doc

1. `chore` (or `documentation`) + `status: evaluation in progress`
2. When started → `status: in progress`
3. When done → `status: released`, close

---

## Notes

- An issue should have exactly one `status:` label at any time — remove the
  previous one before applying a new one.
- Set `target: X.Y.Z` as soon as a version is decided; update it if the target
  changes.
- When blocking on a reporter's response, tag them directly (`@username`).
