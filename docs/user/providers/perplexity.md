# Perplexity

How Nexus AI Chat Importer handles Perplexity exports, and what is specific to
this provider. The shared import workflow is in
[Importing conversations](../importing.md).

The plugin reads two sources:

- **Perplexity's own data export** — your conversations in one archive, requested
  from Perplexity's settings. Start here.
- **The *Perplexity Thread Exporter* browser extension** — a third-party tool
  whose archives carry a few details the official export leaves out (see
  [What is imported](#what-is-imported)).

## Get your export

In Perplexity, click your profile icon, open **All settings**, then **Account**.
In the **System** section, choose **Export my data**, then **Request Export**.
Import the `.zip` you receive as-is — do not extract it or select a file inside
it.

### Using the Thread Exporter extension instead

> This project does **not** bundle, endorse, review, or support that extension.
> Installing browser extensions carries risk — review its permissions and privacy
> policy yourself before using it.

If the extension produced an outer `.zip` that holds `perplexity_*` part zips,
**extract the outer archive first** and import the part zip(s).

## Recognised archive layout

- **Official export:** a `.zip` holding `conversations-<date>_<time>-<code>.json`,
  which contains all the exported conversations. The account spreadsheet next to it
  (`user-data-….xlsx`) is not read.
- **Extension:** a `.zip` holding JSON files whose name starts with `perplexity_`
  (they may sit inside a folder), one per thread, in either the older
  `{ metadata, conversations[] }` form or the newer `{ thread_metadata?, entries[] }`
  form.

**Loose JSON is rejected** — the files must be inside a `.zip`.

## What is imported

Each question and its answer become a user message and an assistant message,
sorted by time. Every note has the conversation title and its timestamps. The
official export always adds the **modes** the thread used (for example `CONCISE` or
`COPILOT`) and a link back to the thread; the extension adds them when its archive
carries them.

The sources differ in what else they carry:

| In the note | Official export | Extension |
|---|---|---|
| Model of each answer (`models:`) | — | ✅ |
| **Related Queries** list at the end | — | ✅ |
| **References** section (title, URL, snippet) | — | Older form only, when its `sources[]` field is filled |

**Citation markers** such as `[1][2]` are removed from an answer that has no
References section: without their sources they point nowhere. Code, links and
questions are left as they are.

### Mixing both sources

The plugin identifies conversations and answers by Perplexity's own IDs in every
format, so importing one source over notes created from the other is meant to add
only the answers a note does not have yet, leaving what it already holds alone. An
export that names no model or mode leaves the note's `models:` and `mode:` as they
were.

Conversations are matched reliably. **Answers have not been verified across
sources**: it has not been possible to compare an official export and an extension
archive of the same thread. If a note gains a second copy of answers it already
had, please [open an
issue](https://github.com/Superkikim/nexus-ai-chat-importer/issues) and attach one
affected note — remove anything private from it first. That example is what makes
the problem fixable.

A **rebuild** regenerates the whole note from the archive you import — see
[Updates and rebuilds](../importing.md#updates-and-rebuilds). Rebuilding from the official export
drops the model names, related queries and references an extension archive had
added.

## Attachments

Perplexity exports carry no files. Files and images are not imported.

## Provider-specific troubleshooting

- "Unsupported archive": the `.zip` holds neither a
  `conversations-<date>_<time>-<code>.json` file nor a `perplexity_*.json` file,
  or you selected a loose JSON file, or an outer wrapper zip from the extension.
  Extract that one to its part zip(s).
- No references in the notes: only the extension's older form can include a
  source list; the official export and the extension's newer form do not.

## Related

- [Importing conversations](../importing.md) — the shared workflow, modes,
  updates, and rebuilds
- [Attachments](../attachments.md) · [What gets created](../output.md) ·
  [Import reports](../reports.md) · [Troubleshooting](../troubleshooting.md)
