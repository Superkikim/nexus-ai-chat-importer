// SPDX-License-Identifier: GPL-3.0-or-later
//
// Placeholder for a generated image the export did not ship: the prompt is
// kept, and the loss is stated instead of silent.

import { StandardAttachment } from "../types/standard";
import { splitLines } from "../utils";

export interface MissingGeneratedImageOptions {
    /** Why the image is absent, recorded on the attachment status. */
    note?: string;
    /** Where the image can still be seen, linked from the warning line. */
    sourceUrl?: string;
    /** What was generated, for the heading (default "Generated image"). */
    label?: string;
}

/** Build a placeholder attachment for an image that the export omitted. */
export function createMissingGeneratedImageAttachment(
    promptText?: string,
    options: MissingGeneratedImageOptions = {}
): StandardAttachment {
    const trimmed = (promptText || "").trim();
    const link = options.sourceUrl
        ? ` [Open original](${options.sourceUrl})`
        : "";
    const label = options.label ?? "Generated image";
    const noun = label === "Generated image" ? "image" : label.toLowerCase();
    const warning = `this export did not include the ${noun}${link}`;

    let extractedContent: string;
    if (trimmed) {
        const formattedPrompt = splitLines(trimmed).join("\n>> ");
        extractedContent = `>>[!nexus_prompt] **Image prompt**
>> \`\`\`
>> ${formattedPrompt}
>> \`\`\`
>
>>[!nexus_attachment] **${label} — not in export**
>> ${warning}`;
    } else {
        extractedContent = `>>[!nexus_attachment] **${label} — not in export**
>> ${warning}`;
    }

    return {
        fileName: "generated_image_not_in_export.png",
        fileType: "image/png",
        attachmentType: "generated_image",
        generationPrompt: trimmed || undefined,
        extractedContent,
        status: {
            processed: true,
            found: false,
            reason: "not_in_export",
            note:
                options.note ??
                "This export did not include the generated image.",
        },
    };
}
