# Mistral Vibe

Covers what is specific to Mistral Vibe (formerly Le Chat). The shared workflow is
in [Importing conversations](../importing.md).

## Get your export

Vibe has a dedicated data-export tool in its settings; use its **Export** action
to produce a `.zip`. For the current location of that tool, see Mistral's help
centre. Import the `.zip` as downloaded — do not select an individual chat file.

## Recognised archive layout

A `.zip` containing one or more `chat-<id>.json` files at the root. **Each file is
one conversation** (a top-level array of messages). Keep every
`chat-<id>-files/` directory next to its matching `chat-<id>.json`; renaming or
repacking can break the link between a message and its uploaded files.

## What is imported

- Messages, sorted by time. The note title is the first user message, trimmed to
  50 characters. Timestamps are derived from the message range.
- Text content. Tool-call chunks and custom UI elements are ignored. A message
  that converts to nothing is labelled *(Empty message)*.
- **Canvas** content is rendered inline in a collapsible callout; slide decks keep
  their `---` separators in a code block.
- **Reference markers** in the text are kept as footnote markers only. Nexus does
  **not** build a bibliography or use the export's `quotes` field — so "references
  and citations are preserved" is not accurate for Vibe.
- An empty chat array cannot be detected as a conversation and is not imported.

## Attachments

- **Your uploaded files** (images, text, documents) are extracted when the payload
  is in the same archive, under `chat-<id>-files/`. Missing uploads are marked as
  not included in the export.
- **Assistant-generated images and files** are referenced by a link to Mistral's
  servers and are **not** included in the export. Nexus inserts a placeholder
  linked to the original conversation; it does not download the remote file. There
  is no generation-prompt reconstruction for these placeholders.

## Provider-specific troubleshooting

- Nothing imported from a chat you expected: check the `chat-<id>.json` is at the
  archive root and its array is not empty.
- An uploaded file is missing: confirm the `chat-<id>-files/` directory is present
  and still named to match its chat file.
