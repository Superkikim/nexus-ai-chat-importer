import { describe, expect, it } from "vitest";

async function createFormatter() {
    (window as any).moment = (value: number) => ({
        format: (pattern: string) => {
            if (pattern === "L") return "01/01/2024";
            if (pattern === "LTS") return "10:00:00";
            return String(value);
        },
    });

    const { MessageFormatter } = await import("./message-formatter");
    const logger = {
        error: () => {},
    } as any;
    const plugin = {
        settings: {
            useCustomMessageTimestampFormat: false,
            messageTimestampFormat: "locale",
        },
    } as any;
    return new MessageFormatter(logger, plugin);
}

/**
 * Lines belonging to the message callout itself — everything before the UID
 * marker. The blank line and `---` separator that follow it are deliberately
 * outside the callout. Every line returned here must keep a ">" prefix, or the
 * blockquote terminates and any nested callout falls outside the message.
 */
function calloutBodyLines(rendered: string): string[] {
    const lines = rendered.split("\n");
    const end = lines.findIndex((l) => l.startsWith("<!-- UID:"));
    return end === -1 ? lines : lines.slice(0, end);
}

describe("MessageFormatter", () => {
    it("shows assistant model in message header when available", async () => {
        const formatter = await createFormatter();
        const rendered = formatter.formatMessage({
            id: "m-1",
            role: "assistant",
            content: "Hello",
            timestamp: 1_700_000_000,
            model: "sonar",
        });

        expect(rendered).toContain("Assistant · sonar");
    });

    it("shows [No content found] for a message with no text and no attachments", async () => {
        const formatter = await createFormatter();
        const rendered = formatter.formatMessage({
            id: "m-empty",
            role: "assistant",
            content: "",
            timestamp: 1_700_000_000,
        });

        expect(rendered).toContain("[No content found]");
    });

    it("does not show [No content found] for a message whose only content is an attachment", async () => {
        const formatter = await createFormatter();
        const rendered = formatter.formatMessage({
            id: "m-synthetic",
            role: "assistant",
            content: "",
            timestamp: 1_700_000_000,
            attachments: [
                {
                    fileName: "Brain_vs_circuit_symbol.png",
                    fileType: "image/png",
                    fileId: "file_img_1",
                    attachmentType: "generated_image",
                },
            ],
        });

        expect(rendered).not.toContain("[No content found]");
        expect(rendered).toContain("Brain_vs_circuit_symbol.png");
    });

    // A blank line without a ">" prefix terminates the blockquote, which would
    // push the nested attachment callouts outside the message callout entirely.
    it("keeps the callout unbroken when a message has no text but has attachments", async () => {
        const formatter = await createFormatter();
        const rendered = formatter.formatMessage({
            id: "m-synthetic",
            role: "assistant",
            content: "",
            timestamp: 1_700_000_000,
            attachments: [
                {
                    fileName: "img.png",
                    fileType: "image/png",
                    fileId: "file_1",
                    attachmentType: "generated_image",
                    extractedContent:
                        ">>[!nexus_prompt] **Image prompt**\n>> a prompt",
                },
            ],
        });

        const breaking = calloutBodyLines(rendered).filter(
            (l) => !l.startsWith(">")
        );
        expect(breaking).toEqual([]);
    });

    it("keeps the callout unbroken for a normal message with text and attachments", async () => {
        const formatter = await createFormatter();
        const rendered = formatter.formatMessage({
            id: "m-normal",
            role: "assistant",
            content: "Here you go.",
            timestamp: 1_700_000_000,
            attachments: [
                {
                    fileName: "img.png",
                    fileType: "image/png",
                    fileId: "file_1",
                    extractedContent: ">>[!nexus_attachment] **img.png**",
                },
            ],
        });

        expect(
            calloutBodyLines(rendered).filter((l) => !l.startsWith(">"))
        ).toEqual([]);
        expect(rendered).toContain("> Here you go.");
    });
});
