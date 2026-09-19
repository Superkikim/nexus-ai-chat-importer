# Grok

How Nexus AI Chat Importer handles Grok (xAI) exports, and what is specific to
this provider. The shared import workflow is in
[Importing conversations](../importing.md).

A Grok export holds two kinds of item, and both become notes:

- your **conversations** with Grok;
- your **Imagine posts** — the images and videos you generated on
  [grok.com/imagine](https://grok.com/imagine), each with its prompt.

## Get your export

Request a copy of your data from your Grok account; for the current location of
that option, see xAI's help centre. Import the `.zip` as downloaded — do not
extract it or select a file inside it.

## Recognised archive layout

A `.zip` containing a `prod-grok-backend.json` file, nested under
`ttl/30d/export_data/<id>/`, and next to it a `prod-mc-asset-server/` folder
holding the files. The whole export — conversations and Imagine posts — lives in
that one JSON file. The export's other files (account, billing) are not read.

## Conversations

- The note title is the one Grok gave the conversation. The note links back to
  the conversation on `grok.com/c/<id>`.
- Messages are ordered by time, to the millisecond. When you asked Grok to
  regenerate an answer, **every version is kept**, in the order it was written.
- The model that wrote each answer is shown on the message.
- **Citations** become links to their source, labelled with its site. Images
  Grok found on the web become a link to the page they came from; they are not
  downloaded.
- **Artifacts** (documents Grok writes inside its answer) are shown inline in a
  collapsible callout, fenced as code when they are code.
- A response with no text and no file (an interrupted or failed answer) is left
  out. A conversation made only of such responses is not imported, and the
  [report](../reports.md#reading-the-summary) counts it as *Ignored — no
  messages*.
- Grok's reasoning, its tool calls and its lists of search results are not
  imported. Projects and scheduled tasks are not imported either.

## Imagine posts

Each Imagine post with a prompt becomes a note titled **`Imagine - `** followed by
the first 50 characters of the prompt. The note holds two messages: your prompt,
then what Grok generated. It links back to the post on
`grok.com/imagine/post/<id>`.

- The export often leaves out the generated media itself. The plugin looks for
  the post's own file, then for the other images generated for the same post:
  Grok writes the post's id into the metadata of the images it generates, and
  that is how they are found. Every image found is saved and embedded.
- When no file is found, the note shows a placeholder saying the export did not
  include the image (or video), with a link to the post.
- **A post without a prompt is not imported**: it has nothing to show but a
  link. The [report](../reports.md#reading-the-summary) counts these posts as
  *Ignored — empty prompt*.

Conversations and Imagine posts share the provider folder
(`<Conversation folder>/grok/<YYYY>/<MM>/`); the `Imagine - ` prefix tells them
apart. The import report counts them in separate columns.

## Attachments

- **Files you uploaded** in a conversation are extracted when the export carries
  them. The export gives them neither a name nor a type: the type is read from
  the file itself, and the file is named after the conversation, the message and
  the file id (`grok_<conversation>_<message>_<file>.jpg`).
- A file the export does not carry — including images Grok edited or generated
  inside a conversation — is marked as missing, with a link to the conversation.
- Files in the export that no conversation or post refers to are not imported:
  nothing tells where they belong.

See [Attachments](../attachments.md) for how saved files are stored and linked.

## Provider-specific troubleshooting

- The archive is not recognised: check it contains `prod-grok-backend.json`. A
  re-packed or partially extracted archive may have lost it.
- Most Imagine notes show a placeholder: expected — the export leaves most
  generated media out. Open the post from the note's link to see it.

## Related

- [Importing conversations](../importing.md) — the shared workflow, modes,
  updates, and rebuilds
- [Attachments](../attachments.md) · [What gets created](../output.md) ·
  [Import reports](../reports.md) · [Troubleshooting](../troubleshooting.md)
