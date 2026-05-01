import fs from "node:fs";
import path from "node:path";

const ROOT_FILES_TO_CHECK = ["README.md", "RELEASE_NOTES.md"];
const DOCS_DIR = "docs";
const SUPPORTED_LOCALES = new Set(["fr", "de", "es", "it", "ru", "zh", "ja", "pt", "ko"]);
const URL_PATTERN = /https:\/\/nexus-prod\.dev\/[^\s)>"']+/g;

function isAllowedPath(pathname) {
    const normalized = pathname.replace(/\/+$/, "");

    if (normalized === "/nexus-ai-chat-importer") return true;
    if (normalized === "/nexus-ai-chat-importer/support") return true;

    const localeMatch = normalized.match(/^\/([a-z]{2})\/nexus-ai-chat-importer(?:\/support)?$/);
    if (!localeMatch) return false;

    return SUPPORTED_LOCALES.has(localeMatch[1]);
}

function extractUrls(content) {
    return content.match(URL_PATTERN) || [];
}

function collectMarkdownFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return [];

    const results = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectMarkdownFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
            results.push(fullPath);
        }
    }

    return results;
}

function main() {
    const filesToCheck = [...ROOT_FILES_TO_CHECK, ...collectMarkdownFiles(DOCS_DIR)];
    const failures = [];
    let checkedCount = 0;

    for (const file of filesToCheck) {
        const absolutePath = path.resolve(process.cwd(), file);
        const content = fs.readFileSync(absolutePath, "utf8");
        const urls = extractUrls(content);

        urls.forEach((rawUrl) => {
            checkedCount += 1;

            let parsed;
            try {
                parsed = new URL(rawUrl);
            } catch (error) {
                failures.push(`${file}: invalid URL "${rawUrl}"`);
                return;
            }

            if (parsed.hostname !== "nexus-prod.dev") {
                failures.push(`${file}: unexpected host in "${rawUrl}"`);
                return;
            }

            if (!isAllowedPath(parsed.pathname)) {
                failures.push(`${file}: unexpected nexus-prod.dev path "${parsed.pathname}" in "${rawUrl}"`);
            }
        });
    }

    if (failures.length > 0) {
        console.error("Documentation link check failed:");
        failures.forEach((failure) => console.error(`- ${failure}`));
        process.exit(1);
    }

    console.log(`Documentation link check passed (${checkedCount} nexus-prod.dev URLs validated across ${filesToCheck.length} markdown files).`);
}

main();
