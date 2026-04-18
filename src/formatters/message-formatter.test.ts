import { describe, expect, it } from "vitest";
 
async function createFormatter() {
    const win = (globalThis as any).window || {};
    win.moment = (value: number) => ({
        format: (pattern: string) => {
            if (pattern === "L") return "01/01/2024";
            if (pattern === "LTS") return "10:00:00";
            return String(value);
        },
    });
    (globalThis as any).window = win;

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
    return new MessageFormatter(logger, plugin as any);
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
});
