import { describe, expect, it } from "vitest";

async function createFormatter() {
    const win = (globalThis as any).window || {};
    win.moment = (value: number) => ({
        format: (pattern: string) => {
            if (pattern === "L") return "01/01/2024";
            if (pattern === "LTS") return "10:00:00";
            if (pattern === "YYYYMMDD") return "20240101";
            return String(value);
        },
    });
    (globalThis as any).window = win;

    const { NoteFormatter } = await import("./note-formatter");
    const logger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
    } as any;
    const plugin = {
        settings: {
            useCustomMessageTimestampFormat: false,
            messageTimestampFormat: "locale",
        },
    } as any;
    return new NoteFormatter(logger, "nexus-ai-chat-importer", "1.6.0", plugin as any);
}

describe("NoteFormatter", () => {
    it("renders universal mode/models frontmatter and related queries section", async () => {
        const formatter = await createFormatter();
        const rendered = formatter.generateMarkdownContent({
            id: "thread-1",
            title: "Test",
            provider: "perplexity",
            createTime: 1_700_000_000,
            updateTime: 1_700_000_100,
            messages: [
                {
                    id: "m-user",
                    role: "user",
                    content: "Q",
                    timestamp: 1_700_000_000,
                },
                {
                    id: "m-assistant",
                    role: "assistant",
                    content: "A",
                    timestamp: 1_700_000_001,
                    model: "sonar",
                },
            ],
            metadata: {
                mode: "CONCISE",
                models: ["sonar"],
                related_queries: ["rq-1", "rq-2"],
            },
        } as any);

        expect(rendered).toContain('mode: "CONCISE"');
        expect(rendered).toContain("models:");
        expect(rendered).toContain('- "sonar"');
        expect(rendered).toContain("## Related Queries");
        expect(rendered).toContain("- rq-1");
    });
});
