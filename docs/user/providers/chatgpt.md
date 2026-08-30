# ChatGPT

Covers what is specific to ChatGPT (OpenAI). The shared workflow — running the
import, choosing conversations, updates and rebuilds — is in
[Importing conversations](../importing.md).

## Get your export

There are two ways to get a ChatGPT export, and they produce **different archive
shapes**. Nexus handles both — see OpenAI's help article
*"Exporting your ChatGPT history and data"* for the current click-paths.

- **From ChatGPT settings** (data controls). The quicker route. OpenAI emails a
  download link, usually valid for about 24 hours; the download is a single `.zip`
  with `conversations.json` (or numbered `conversations-NNN.json`) at its root.
- **From the OpenAI account privacy portal.** An account-level data request. It
  can take noticeably longer to be delivered, and the download is a **container**:
  an outer `.zip` with the conversation `.zip` nested inside it (alongside a
  separate `Files__…` archive that Nexus ignores). Select the **outer** `.zip` as
  downloaded — Nexus unwraps it automatically.

Either way, import the `.zip` as downloaded — do not unzip it.

## Recognised archive layouts

- A `.zip` containing `conversations.json` at the root.
- A `.zip` where the conversations are split into numbered files
  (`conversations-001.json`, …) — they are sorted and merged automatically.
- An **account privacy-portal container** — an outer `.zip` with the conversation
  `.zip` (`…-chatgpt-<digits>…`) nested inside. Handled automatically; see
  [Get your export](#get-your-export) above.

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

- Generated image still a placeholder after re-importing: that export still didn't
  contain the file. Request a fresh export and rebuild the conversation.

## Related

- [Importing conversations](../importing.md) — the shared workflow, modes,
  updates, and rebuilds
- [Attachments](../attachments.md) · [What Nexus creates](../output.md) ·
  [Import reports](../reports.md) · [Troubleshooting](../troubleshooting.md)
