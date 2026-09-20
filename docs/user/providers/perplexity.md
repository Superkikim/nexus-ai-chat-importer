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
sorted by time. Every note has a title and the conversation's timestamps. The
official export also always adds the **modes** the thread used (for example
`CONCISE` or `COPILOT`) and a link back to the thread; the extension adds them when
its archive carries them.

The official export carries no title of its own — it repeats your first question —
so the note title is that question cut to 50 characters, on one line. The
extension's titles are kept whole.

The sources differ in what else they carry:

| In the note | Official export | Extension |
|---|---|---|
| Model of each answer (`models:`) | — | ✅ |
| **Related Queries** list at the end | — | ✅ |
| **References** section (title, URL, snippet) | — | Older form only, when the answer searched the web |

**Citation markers** such as `[1][2]` are removed from an answer that has no
References section: without their sources they point nowhere. Code, links and
questions are left as they are.

### Using both sources

The two exports describe the same conversations, but they number their answers
differently, so a conversation is matched on its identifier and an answer on the
words of the question that asked for it. You can import either source over notes
created from the other:

- an answer the note does not have is **added**;
- an answer the note has **without its sources** is rewritten from the
  extension's archive, which brings its sources, its model and its citation
  markers;
- everything else is left untouched, and a note nothing changes in is not
  rewritten at all.

This works in both directions, and importing the same archive twice changes
nothing. The extension's archive is always older than Perplexity's own export,
so it is read for what it can add rather than skipped for its date — and it
never dates a note back.

One thing it cannot do: bring sources to an answer that has none in either
archive. Perplexity's own export has no sources at all.

A **rebuild** is different — it regenerates the whole note from the archive you
import, see [Updates and rebuilds](../importing.md#updates-and-rebuilds).
Rebuilding from Perplexity's own export drops the sources, model names and
related queries an extension archive had added.

## Attachments

Perplexity exports carry no files. Files and images are not imported.

More detail on the three archives and how they are reconciled:
[architecture / Perplexity export formats](../../architecture/providers/perplexity-export-format.md).

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
