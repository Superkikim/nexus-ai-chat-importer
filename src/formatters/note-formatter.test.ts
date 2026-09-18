import { describe, expect, it } from "vitest";

async function createFormatter(settings: Record<string, unknown> = {}) {
    (window as any).moment = (value: number) => ({
        format: (pattern: string) => {
            if (pattern === "L") return "01/01/2024";
            if (pattern === "LTS") return "10:00:00";
            if (pattern === "YYYYMMDD") return "20240101";
            return String(value);
        },
    });

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
            ...settings,
        },
    } as any;
    return new NoteFormatter(logger, "nexus-ai-chat-importer", "1.6.1", plugin);
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

    describe("custom ID property", () => {
        const conversation = {
            id: "6789abcd-0000-1111-2222-333344445555",
            title: "Test",
            provider: "chatgpt",
            createTime: 1_700_000_000,
            updateTime: 1_700_000_100,
            messages: [],
        } as any;

        it("writes the property right after conversation_id", async () => {
            const formatter = await createFormatter({
                customIdProperty: "uid",
            });
            const rendered = formatter.generateMarkdownContent(conversation);

            expect(rendered).toContain(
                "conversation_id: 6789abcd-0000-1111-2222-333344445555\n" +
                    "uid: 6789abcd-0000-1111-2222-333344445555\n" +
                    "create_time:"
            );
        });

        it("writes nothing when the setting is empty or invalid", async () => {
            for (const customIdProperty of ["", undefined, "tags"]) {
                const formatter = await createFormatter({ customIdProperty });
                const rendered =
                    formatter.generateMarkdownContent(conversation);
                const frontmatter = rendered.split("\n---\n")[0];

                expect(frontmatter.split("\n")).toHaveLength(8);
                expect(frontmatter).not.toMatch(/^(uid|tags):/m);
            }
        });
    });
});
