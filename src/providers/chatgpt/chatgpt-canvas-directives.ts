// SPDX-License-Identifier: GPL-3.0-or-later
//
// ChatGPT Canvas directive handling.
//
// The 2026 ChatGPT export inlines Canvas ("textdoc") content using CommonMark
// generic/container directives:
//
//     :::writing{variant="social_post" id="58142"}
//     ...body...
//     :::
//
// This syntax is an experimental CommonMark proposal (remark-directive) and is
// NOT rendered by Obsidian, so it leaks into notes as raw text. This module
// converts each directive block into a clean, collapsible Obsidian callout.
//
// The output uses a single leading ">" per line. The message formatter prefixes
// every content line with an extra ">", turning the callout into a properly
// nested "        >>[!nexus_canvas]-" block inside the message callout.

const OPEN_RE = /^:::([a-zA-Z][\w-]*)\{([^}]*)\}\s*$/;
const CLOSE_RE = /^:::\s*$/;

/** Human-readable label for a known Canvas variant. */
function labelForVariant(
    variant: string | undefined,
    subject?: string
): string {
    switch ((variant || "").toLowerCase()) {
        case "social_post":
            return "Social post";
        case "document":
            return "Document";
        case "email":
            return subject ? `Email — ${subject}` : "Email";
        case "standard":
            return "Draft";
        default:
            return "Canvas";
    }
}

/** Parse `key="value"` attribute pairs from a directive header. */
function parseAttributes(raw: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const re = /([a-zA-Z_][\w-]*)\s*=\s*"([^"]*)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(raw)) !== null) {
        attrs[match[1]] = match[2];
    }
    return attrs;
}

/** Build the callout lines for a single directive block. */
function renderCallout(
    directiveName: string,
    attrsRaw: string,
    body: string[]
): string[] {
    const attrs = parseAttributes(attrsRaw);
    // Only the "writing" directive is a Canvas document; anything else still
    // gets a generic Canvas label so no raw ":::" syntax survives.
    const label =
        directiveName === "writing"
            ? labelForVariant(attrs.variant, attrs.subject)
            : labelForVariant(undefined);

    const lines: string[] = [`>[!nexus_canvas]- **${label}**`];
    for (const bodyLine of body) {
        // Empty lines must keep the ">" prefix so the nested callout stays open
        // after the formatter adds its own ">".
        lines.push(bodyLine.trim() === "" ? ">" : `> ${bodyLine}`);
    }
    return lines;
}

/**
 * Convert ChatGPT Canvas `:::writing{...}` directive blocks in `text` into
 * collapsible Obsidian callouts. Tolerant of multiple blocks and of an
 * unterminated trailing block (the body is kept, the opener is dropped).
 * Non-directive text passes through unchanged.
 */
export function transformCanvasDirectives(text: string): string {
    if (!text || typeof text !== "string" || !text.includes(":::")) {
        return text;
    }

    const lines = text.split("\n");
    const out: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const open = OPEN_RE.exec(lines[i]);
        if (!open) {
            out.push(lines[i]);
            continue;
        }

        const directiveName = open[1];
        const attrsRaw = open[2];
        const body: string[] = [];
        let j = i + 1;
        let closed = false;
        for (; j < lines.length; j++) {
            if (CLOSE_RE.test(lines[j])) {
                closed = true;
                break;
            }
            body.push(lines[j]);
        }

        out.push(...renderCallout(directiveName, attrsRaw, body));
        // Skip the consumed body (and the closing fence when present).
        i = closed ? j : j - 1;
    }

    return out.join("\n");
}
