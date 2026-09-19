// SPDX-License-Identifier: GPL-3.0-or-later
//
// A document the assistant produced inside its reply (Vibe canvas, Grok
// artifact) is rendered as a collapsed callout appended to the message. The
// single leading ">" is doubled by the message formatter when the callout
// ends up nested inside a message callout.

import { splitLines } from "../utils";

export interface CollapsedCalloutOptions {
    /**
     * Wrap the content in a code fence: `true` for a plain fence, a string for
     * a fence tagged with that language.
     */
    fence?: boolean | string;
}

export function renderCollapsedCallout(
    type: string,
    label: string,
    content: string,
    options: CollapsedCalloutOptions = {}
): string {
    const lines: string[] = [`>[!${type}]- **${label}**`];
    const fence =
        options.fence === true
            ? "```"
            : typeof options.fence === "string"
            ? `\`\`\`${options.fence}`
            : null;

    if (fence) lines.push(`> ${fence}`);
    for (const line of splitLines(content || "")) {
        lines.push(line === "" ? ">" : `> ${line}`);
    }
    if (fence) lines.push("> ```");

    return lines.join("\n");
}
