# ChatGPT

Covers what is specific to ChatGPT (OpenAI). The shared workflow — running the
import, choosing conversations, updates and rebuilds — is in
[Importing conversations](../importing.md).

## Get your export

Request a data export from ChatGPT's settings (data controls / privacy). OpenAI
emails you a download link; the link typically expires within about 24 hours, and
the download is a `.zip`. For the current click-path, see OpenAI's own help
article, *"Exporting your ChatGPT history and data"* — it stays current when the UI
changes.

Import the `.zip` as downloaded — do not unzip it.

## Recognised archive layouts

- A `.zip` containing `conversations.json` at the root.
- A `.zip` where the conversations are split into numbered files
  (`conversations-001.json`, …) — they are sorted and merged automatically.
- An **OpenAI privacy-portal container**: an outer `.zip` whose inner
  conversation `.zip` matches `…-chatgpt-<digits>…`. Select the outer file as-is;
  Nexus unwraps it. (A *compressed* inner zip is not unwrapped — extract it
  yourself in that case.)

## What is imported

- Conversation title, timestamps, messages, the model(s) used, archived/starred
  state, and a link back to the original chat.
- Text, multimodal text, code, transcribed audio text, Canvas documents, and
  product-recommendation blocks (rendered as a short summary linking to the
  original chat).
- System, tool, and hidden messages are filtered out.

**Citations are not preserved.** ChatGPT's inline citation / search markers are
stripped from the text; there is no reference section for ChatGPT.

## Attachments and generated content

- **Your uploads** (images, PDFs, documents) are extracted when their bytes are in
  the export. Older exports often did not include them — those show as *not
  included in export*.
- **DALL-E / generated images:** recoverable only when the export actually carries
  the image data (either the older `dalle-generations/…` files, or the newer file
  library with a matching payload). When the export references image generation but
  includes no file, Nexus inserts an explicit "not in export" placeholder.
- **Generated documents** (Canvas "reports", e.g. `.docx`) are imported when the
  file library includes them.
- **Voice recordings are never imported** — the audio is intentionally skipped.
  The **transcription text** of a voice message can still appear in the note.

Do not expect every generated image or document to come back; it depends entirely
on what OpenAI put in that particular export. Missing items cannot be
reconstructed — the note links back to ChatGPT where possible.

More detail on the 2026 export internals:
[architecture / ChatGPT export format](../../architecture/providers/chatgpt-export-format.md).

## Provider-specific troubleshooting

- "Nested ZIP" error on a privacy-portal download whose inner zip is compressed:
  extract the outer archive and import the inner conversation `.zip`.
- Generated image still a placeholder after re-importing: that export still didn't
  contain the file. Request a fresh export and rebuild the conversation.
