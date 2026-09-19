// SPDX-License-Identifier: GPL-3.0-or-later
//
// Titles derived from message text (providers whose export carries no title
// for an item) are cut to a short preview, so the note title — and the file
// name built from it — stays readable.

export const TITLE_PREVIEW_MAX_CHARS = 50;

export function truncateTitlePreview(content: string): string {
    const trimmed = (content || "").trim();
    if (!trimmed) return "Untitled";
    if (trimmed.length <= TITLE_PREVIEW_MAX_CHARS) return trimmed;
    return `${trimmed.substring(0, TITLE_PREVIEW_MAX_CHARS).trim()}...`;
}
