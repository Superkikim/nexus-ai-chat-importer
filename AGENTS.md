# Project Agent Instructions

These instructions apply to every coding agent working in this repository. Tool-specific files may explain how to load them, but must not redefine or weaken them.

## Ownership and attribution

- The repository and its deliverables are the maintainer's work.
- Never add AI-assistance attribution, generated-by notices, tool or model signatures, or assistant names to source files, documentation, release notes, credits, commit messages, or commit trailers.
- Never add `Co-authored-by`, `Signed-off-by`, or similar attribution trailers on behalf of an assistant or vendor.
- Do not change Git author configuration. Use the identity already configured in Git.
- The agent completing a task is responsible for committing and pushing its validated, in-scope work unless the maintainer explicitly says not to.
- Before staging, inspect every changed and untracked file intended for the commit. Commit and push only material that is appropriate for this public repository. Never stage secrets, credentials, private notes, personal data, provider export data, `.agent-work/`, or unrelated user changes.
- Tags, releases, pull requests, merges, and deployments still require explicit authorization for that exact action.
- Credits are curated by the maintainer. Preserve existing human credits and add people only when explicitly requested.

## Sources of truth

When sources disagree, use this evidence order:

1. Executed tests and observable behavior.
2. Current implementation, types, configuration, and locale files.
3. Test fixtures and supported export samples.
4. Release-specific decisions and release notes.
5. README and existing documentation.

Documentation is evidence to audit, not proof that behavior still works as described. Never turn an inference into a stated fact. Record unresolved contradictions in the task's uncertainty log.

## Working agreements

- Optimize user-facing work for clarity, discoverability, and task completion. UX is a requirement, not a finishing pass.
- Keep each fact canonical in one location. Link to it from other pages rather than maintaining competing explanations.
- Preserve the user's existing changes and keep unrelated edits out of scope.
- Prefer small, reviewable diffs and deterministic checks.
- For substantial work, maintain progress and findings in `.agent-work/`; this directory is local and must never be committed.
- Continue through non-blocking uncertainty: choose the safest reversible assumption and record it. Ask the maintainer only when a choice would materially change product behavior, public information architecture, data safety, or scope.
- An agent must not be the sole judge of its own substantial work. Use an independent review pass with fresh context before declaring completion.

## Validation

Choose checks proportional to the change. The normal full quality gate is:

```bash
npm run type-check
npm run test:run
npx eslint src/
npm run build
npm run check:docs-links
```

Documentation-only work does not automatically require every code check, but must validate links, Markdown structure, navigation, and any generated output it affects. Report exactly which checks ran and which did not.

## Repository guidance

- Read `CLAUDE.md` as a technical orientation to the current architecture and commands. Verify version-sensitive claims against the repository before relying on them.
- Read `docs/README.md` before reorganizing or adding documentation.
- Reusable task workflows live in `.agents/skills/`. Use the matching skill when the request falls within its description.
- Existing flat files under `docs/` are legacy maintainer documentation until the documentation restructuring is completed. Do not expose them automatically on the public website.

## Public, maintainer, and private material

- `README.md`: repository overview, concise installation entry point, project links, license, support, and maintainer-curated credits.
- `docs/user/`: canonical public English user documentation and future source for the documentation website.
- `docs/development/`: public contributor and maintenance documentation that is not published as user documentation.
- `docs/architecture/`: public technical architecture and implementation references.
- `.agents/`: versioned agent policies and reusable workflows. These are operational project files, not user documentation.
- `.agent-work/`: ignored local working state, raw audits, uncertainty ledgers, and temporary review artifacts.

Anything genuinely confidential must stay outside this public repository. A file that is not rendered on the website is still public if it is committed here.
