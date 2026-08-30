# Perplexity

Covers what is specific to Perplexity. The shared workflow is in
[Importing conversations](../importing.md).

## Getting a compatible export

Perplexity does not offer a first-party bulk export that this plugin can read.
The archives Nexus recognises are produced by a **third-party browser extension**,
the *"Perplexity Thread Exporter"*.

> This project does **not** bundle, endorse, review, or support that extension.
> Installing browser extensions carries risk — review its permissions and privacy
> policy yourself before using it. If Perplexity later ships a compatible native
> export, this page will be updated.

## Recognised archive layout

A `.zip` containing JSON files whose name starts with `perplexity_` (they may sit
inside a folder). Two schemas are accepted:

- the older `{ metadata, conversations[] }` form;
- the newer `{ thread_metadata?, entries[] }` form.

Rules:

- **Loose JSON is rejected** — the files must be inside a `.zip`.
- If your download is an outer `.zip` containing the `perplexity_*` part zips,
  **extract the outer archive first** and import the part zip(s).

## What is imported

- Each turn becomes a user query and an assistant answer, sorted by time.
- Conversation title, timestamps, the thread URL, model(s), mode, and
  **related queries** (added as a *Related Queries* list at the end of the note)
  when the export includes them.
- **Source lists** are imported **only** from the older schema's `sources[]`
  field, as a *References* section with title, URL, and an optional snippet. The
  newer schema does not carry a source collection, so most current exports will
  have no reference section — this is expected, not a bug.

## Attachments

Perplexity exports are not processed for attachments. Files and images are not
imported.

## Provider-specific troubleshooting

- "Unsupported archive": the `.zip` has no `perplexity_*.json` file, or you
  selected a loose JSON file, or an outer wrapper zip. Extract to the part zip(s).
- No references in the notes: your export uses the newer schema, which does not
  include a source list.
