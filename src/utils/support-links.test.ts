import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
    getLocalizedDocsUrl,
    getLocalizedSupportUrl,
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

