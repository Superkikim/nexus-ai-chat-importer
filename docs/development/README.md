# Development and maintenance

Contributor and maintainer documentation. These pages are **not** published as user
documentation.

Before contributing, read [`AGENTS.md`](../../AGENTS.md) (shared working agreements,
attribution, Git, evidence, validation) and [`CLAUDE.md`](../../CLAUDE.md)
(technical orientation — verify version-sensitive claims against the source).

| Page | Purpose |
|---|---|
| [Adding a provider](adding-a-provider.md) | Implement, wire, and test support for a new export source. |
| [Issue workflow](issue-workflow.md) | Title conventions, labels, and the issue lifecycle. |
| [Release workflow](release-workflow.md) | The end-to-end release procedure, from quality gate to registry pickup. |

## Quick reference

```bash
npm run type-check     # vitest does NOT type-check — run this separately
npm run test:run       # all tests
npx eslint src/        # zero errors on modified files
npm run build          # must succeed
npm run check:docs-links   # relative links + nexus-prod.dev URLs in docs
```

Architecture references live in [`docs/architecture/`](../architecture/README.md).
