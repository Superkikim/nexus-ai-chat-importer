import fs from "node:fs";
import path from "node:path";

const ROOT_FILES_TO_CHECK = ["README.md", "RELEASE_NOTES.md"];
const DOCS_DIR = "docs";
const SUPPORTED_LOCALES = new Set(["fr", "de", "es", "it", "ru", "zh", "ja", "pt", "ko"]);
const NEXUS_URL_PATTERN = /https:\/\/nexus-prod\.dev\/[^\s)>"']+/g;

// Markdown inline links / images: [text](target) and ![alt](target).
// Reference-style definitions: [label]: target
const INLINE_LINK_PATTERN = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const REFERENCE_DEF_PATTERN = /^\s*\[[^\]]+\]:\s+(\S+)/gm;

function isAllowedNexusPath(pathname) {
    const normalized = pathname.replace(/\/+$/, "");

    if (normalized === "/nexus-ai-chat-importer") return true;
    if (normalized === "/nexus-ai-chat-importer/support") return true;

    const localeMatch = normalized.match(/^\/([a-z]{2})\/nexus-ai-chat-importer(?:\/support)?$/);
    if (!localeMatch) return false;

    return SUPPORTED_LOCALES.has(localeMatch[1]);
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

function checkNexusUrls(file, content, failures) {
    let checked = 0;
    const urls = content.match(NEXUS_URL_PATTERN) || [];

    for (const rawUrl of urls) {
        checked += 1;

        let parsed;
        try {
            parsed = new URL(rawUrl);
        } catch {
            failures.push(`${file}: invalid URL "${rawUrl}"`);
            continue;
        }

        if (parsed.hostname !== "nexus-prod.dev") {
            failures.push(`${file}: unexpected host in "${rawUrl}"`);
            continue;
        }

        if (!isAllowedNexusPath(parsed.pathname)) {
            failures.push(
                `${file}: unexpected nexus-prod.dev path "${parsed.pathname}" in "${rawUrl}"`
            );
        }
    }

    return checked;
}

function stripCode(content) {
    // Remove fenced code blocks first, then inline code spans, so example
    // snippets inside documentation are not treated as real links.
    return content
        .replace(/```[\s\S]*?```/g, "")
        .replace(/~~~[\s\S]*?~~~/g, "")
        .replace(/`[^`\n]*`/g, "");
}

function isExternalOrIgnorable(target) {
    if (!target) return true;
    // Anchors on the same page, protocol links, mail, protocol-relative, templated.
    if (target.startsWith("#")) return true;
    if (target.startsWith("mailto:")) return true;
    if (target.startsWith("//")) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return true; // http:, https:, obsidian:, etc.
    if (target.includes("{{")) return true; // locale template placeholders
    return false;
}

function checkRelativeLinks(file, rawContent, failures) {
    let checked = 0;
    const fileDir = path.dirname(file);
    const content = stripCode(rawContent);
    const targets = [];

    let match;
    INLINE_LINK_PATTERN.lastIndex = 0;
    while ((match = INLINE_LINK_PATTERN.exec(content)) !== null) {
        targets.push(match[1]);
    }
    REFERENCE_DEF_PATTERN.lastIndex = 0;
    while ((match = REFERENCE_DEF_PATTERN.exec(content)) !== null) {
        targets.push(match[1]);
    }

    for (const rawTarget of targets) {
        if (isExternalOrIgnorable(rawTarget)) continue;

        checked += 1;

        // Strip a trailing anchor; we only verify the file resolves, not the heading.
        const [pathPart] = rawTarget.split("#");
        if (!pathPart) continue; // pure "#anchor" already handled, but be safe

        const decoded = decodeURIComponent(pathPart);
        const resolved = path.resolve(fileDir, decoded);

        if (!fs.existsSync(resolved)) {
            failures.push(`${file}: broken relative link "${rawTarget}" -> ${path.relative(process.cwd(), resolved)}`);
        }
    }

    return checked;
}

function main() {
    const filesToCheck = [...ROOT_FILES_TO_CHECK, ...collectMarkdownFiles(DOCS_DIR)];
    const failures = [];
    let nexusUrlCount = 0;
    let relativeLinkCount = 0;

    for (const file of filesToCheck) {
        const absolutePath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(absolutePath)) continue;
        const content = fs.readFileSync(absolutePath, "utf8");

        nexusUrlCount += checkNexusUrls(file, content, failures);
        relativeLinkCount += checkRelativeLinks(file, content, failures);
    }

    if (failures.length > 0) {
        console.error("Documentation link check failed:");
        failures.forEach((failure) => console.error(`- ${failure}`));
        process.exit(1);
    }

    console.log(
        `Documentation link check passed (${nexusUrlCount} nexus-prod.dev URLs and ` +
            `${relativeLinkCount} relative links validated across ${filesToCheck.length} markdown files).`
    );
}

main();
