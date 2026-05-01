import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
    getCommunityForumUrl,
    getLocalizedDocsUrl,
    getLocalizedSupportUrl,
    getIssuesUrl,
    getReleaseNotesUrl,
    getSupportedNexusLocales,
} from "./support-links";

describe("support-links", () => {
    it("returns localized docs and support URLs for supported locales", () => {
        expect(getLocalizedDocsUrl("fr")).toBe("https://nexus-prod.dev/fr/nexus-ai-chat-importer");
        expect(getLocalizedSupportUrl("fr")).toBe("https://nexus-prod.dev/fr/nexus-ai-chat-importer/support");
    });

    it("normalizes region locales before resolving URLs", () => {
        expect(getLocalizedDocsUrl("pt-BR")).toBe("https://nexus-prod.dev/pt/nexus-ai-chat-importer");
        expect(getLocalizedSupportUrl("zh_CN")).toBe("https://nexus-prod.dev/zh/nexus-ai-chat-importer/support");
    });

    it("falls back to default docs/support URLs for unsupported locales", () => {
        expect(getLocalizedDocsUrl("en")).toBe("https://nexus-prod.dev/nexus-ai-chat-importer");
        expect(getLocalizedDocsUrl("xx")).toBe("https://nexus-prod.dev/nexus-ai-chat-importer");
        expect(getLocalizedSupportUrl("xx")).toBe("https://nexus-prod.dev/nexus-ai-chat-importer/support");
    });

    it("exposes the supported locale list", () => {
        expect(getSupportedNexusLocales()).toEqual(["fr", "de", "es", "it", "ru", "zh", "ja", "pt", "ko"]);
    });

    it("returns centralized resource links", () => {
        expect(getReleaseNotesUrl()).toBe("https://github.com/Superkikim/nexus-ai-chat-importer/blob/master/RELEASE_NOTES.md");
        expect(getReleaseNotesUrl("dev-1.6.2")).toBe("https://github.com/Superkikim/nexus-ai-chat-importer/blob/dev-1.6.2/RELEASE_NOTES.md");
        expect(getIssuesUrl()).toBe("https://github.com/superkikim/nexus-ai-chat-importer/issues");
        expect(getCommunityForumUrl()).toBe("https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-and-claude-conversations-to-your-vault/71664");
    });

    it("ensures migrated call-sites no longer hardcode support URLs", () => {
        const filesToCheck = [
            "src/ui/components/support-box.ts",
            "src/dialogs.ts",
            "src/upgrade/versions/upgrade-1.2.0.ts",
        ];

        filesToCheck.forEach((relativePath) => {
            const absolutePath = path.resolve(process.cwd(), relativePath);
            const content = fs.readFileSync(absolutePath, "utf8");
            expect(content).not.toContain("nexus-ai-chat-importer/support");
        });
    });
});
