# Import reports

Nexus AI Chat Importer writes a report after every import so you can see exactly
what happened.

## The completion dialog

When an import finishes, a dialog summarises it: only the outcome counts that are
non-zero (or "Nothing in your vault changed"), the archive context, the attachment
counts, and a **View Report** button that opens the full summary.

If the plugin cannot create the report folder or write the reports, it shows a failure
notice and a short "import completed" notice instead — with no completion dialog
and no report link.

## The three report files

Reports go to `<Report folder>/<provider>/` (default `Nexus/Reports/chatgpt/`,
etc.). Each import creates three Markdown files sharing a timestamp prefix
(`YYYYMMDD-HHmmss`); if those names already exist, the prefix gains `-2`, `-3`, …

| File | Purpose |
|---|---|
| `… - import summary.md` | The operational overview — start here. |
| `… - index heavy.md` | Detailed per-conversation tables with note links and counts. |
| `… - index mobile.md` | A compact, title-sorted list of links, easy to skim on a phone. |

"Heavy" and "mobile" describe the reading format, not where they were generated —
you get all three on desktop and mobile. All three carry frontmatter with the
import date, provider, mode (all / selective), archive counts, note outcomes, and
cross-links to the other two.

## Reading the summary

- **Files** — which of the three report files were written, and the archive
  filename(s).
- **Archive counters** — conversations found, duplicates removed across archives,
  kept, selected. These appear only when an analysis phase ran; the mobile
  Import All path omits them rather than showing zeros.
- **Outcomes**:

  | Outcome | Meaning |
  |---|---|
  | Created | New note written |
  | Updated | Existing note, new messages appended |
  | Recreated | Existing note rebuilt from scratch (Reprocess / Rebuild) |
  | Unchanged | Already up to date, skipped |
  | Empty | Conversation had no exportable content |
  | Failed | Could not be imported — reason listed |

- **Attachments** — counts for extracted, in-the-note, not-in-the-export, missing,
  and failed, plus artifacts.
- **Errors** — any global errors, and per-conversation failure reasons.

The **heavy index** expands Created / Updated / Recreated / Failed into dated
tables with a link to each note, its message count, and a provider-specific column
(for example attachments, artifacts, or turns).

## Related

- [Importing conversations](importing.md) · [What gets created](output.md) ·
  [Troubleshooting](troubleshooting.md)
