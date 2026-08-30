# Documentation

This directory holds the project's documentation, split by audience. Everything
here is public, whether or not it is rendered on the documentation website.

| Location | Audience | On the website |
|---|---|---|
| [`user/`](user/README.md) | Plugin users | Yes — canonical English source |
| [`development/`](development/README.md) | Contributors and maintainers | No |
| [`architecture/`](architecture/README.md) | Contributors and maintainers | No |
| `../RELEASE_NOTES.md` | Everyone | No — changelog at the repository root |
| `.agents/` | Coding agents and automation | No |
| `.agent-work/` | Local task state | Never committed |

## User documentation — [`user/`](user/README.md)

Task-oriented help, organised for navigation and search rather than mirroring the
code. [`user/README.md`](user/README.md) is the entry point and the full
navigation.

- **Common workflow:** getting started, importing, settings, what Nexus creates,
  attachments, reports, CLI, privacy, troubleshooting.
- **Per provider:** [ChatGPT](user/providers/chatgpt.md),
  [Claude](user/providers/claude.md),
  [Mistral Vibe](user/providers/mistral-vibe.md),
  [Perplexity](user/providers/perplexity.md) — each covers only provider-specific
  behaviour and links back to the common pages.

## Development — [`development/`](development/README.md)

Contributor and maintainer procedure: [adding a
provider](development/adding-a-provider.md), the [issue
workflow](development/issue-workflow.md), the [release
workflow](development/release-workflow.md).

## Architecture — [`architecture/`](architecture/README.md)

How the plugin is built: the [import pipeline](architecture/import-pipeline.md),
the [archive pipeline](architecture/archive-pipeline.md), [attachment
handling](architecture/attachment-handling.md), [link
updates](architecture/link-updates.md), and the observed [ChatGPT export
format](architecture/providers/chatgpt-export-format.md).

## Editorial rules

- The repository [`README.md`](../README.md) is the project overview: purpose,
  quick install, links, support, license, credits, and a short guide to what is in
  this directory. It is not a second user manual.
- Each fact has one canonical home. Provider-specific behaviour lives on that
  provider's page; shared behaviour is explained once in the common pages and
  linked, not copied.
- Treat older documentation and release notes as material to verify. For any
  user-facing claim, current code and tests win.
