# Claude

Covers what is specific to Claude (Anthropic). The shared workflow is in
[Importing conversations](../importing.md).

## Get your export

Request a data export from Claude's settings (privacy). Anthropic emails you a
download link; the link typically expires within about 24 hours. Availability
depends on your account/plan. For the current click-path, see Anthropic's help
article, *"How can I export my Claude data?"*.

Import the `.zip` as downloaded.

## Recognised archive layouts

- **Legacy combined export:** a `.zip` with `conversations.json` **and**
  `users.json` at the root.
- **Newer split export:** a `.zip` whose only conversation file is
  `conversations.json` (Claude message structure). `users.json` is **not**
  required here.

Companion archives — project, memory, or light-metadata parts — are **not**
conversation imports and are rejected. Import the conversation part.

## What is imported

- Conversation title, timestamps, model(s), summary, starred state, project
  reference, messages, and a link back to the original chat.
- Human and assistant messages, including text blocks, useful artifact and
  file operations, inline extracted attachments, and named file references.
- Empty messages and internal tool-only messages are dropped.
- **Web citations** are kept only when a text block carries citation details with
  a URL; duplicate URLs are merged. Quoted snippets are not reproduced.

## Attachments and artifacts

- **Inline extracted text** (`.txt`, `.docx`, code files, …): Claude puts the
  extracted content directly in the export. It is shown in a collapsible
  attachment callout, formatted according to its type. Very long extracts are
  moved to a linked file to keep the note readable.
- **Named files:** Nexus looks for the file's bytes in the archive. If present,
  images, text, and documents are extracted; if absent, you get a placeholder and
  a link to the conversation. (It is not true that Claude exports never contain
  binary files — it depends on the export.)
- **Artifacts:** recognised textual artifact operations (create / update) produce
  versioned Markdown artifacts. This requires the export to actually contain the
  artifact text — do not expect "all artifacts" or a full version history.
- Generated binary outputs referenced through Claude's `computer:///` links are
  **not** downloaded; they become placeholders.

## Provider-specific troubleshooting

- Import rejected as a companion/metadata archive: you selected a project or
  memory part. Select the conversation part instead.
- A named attachment shows as missing: its bytes weren't in the export. Text that
  Claude already embedded in the conversation is still preserved.
