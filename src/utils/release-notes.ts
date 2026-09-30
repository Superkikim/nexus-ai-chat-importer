import { requestUrl } from "obsidian";
import { GITHUB } from "../config/constants";

/**
 * Matches the README's "What's new" heading, with or without a trailing version
 * and with either apostrophe. The section is fetched at the version's own tag,
 * so whichever "What's new" it carries is the right one for that release.
 */
const WHATS_NEW_HEADING = /^##\s+What['‘’`]s new\b[^\n]*\n/im;

/**
 * Pull the body of the README's `## What's new …` section — the short,
 * headline-only summary of the release. Returns `null` when the section is
 * absent.
 *
 * The upgrade and new-version dialogs render this. `RELEASE_NOTES.md` stays the
 * full changelog and is linked from the section rather than shown in the modal.
 */
export function extractWhatsNewSection(readmeText: string): string | null {
    const norm = readmeText.replace(/\r\n/g, "\n");

    const start = WHATS_NEW_HEADING.exec(norm);
    if (!start) return null;

    const rest = norm.slice(start.index + start[0].length);
    const next = rest.search(/^##\s/m);
    const body = (next === -1 ? rest : rest.slice(0, next)).trim();

    return body.length > 0 ? body : null;
}

/**
 * The README from its top down to the "What's new" section — the intro,
 * supported providers and features — for the first-install dialog. The H1,
 * badge lines and `>` notes are dropped, and `##` headings become `###` to
 * sit under the dialog's own title. Returns `null` when nothing is left.
 */
export function extractReadmeOverview(readmeText: string): string | null {
    const norm = readmeText.replace(/\r\n/g, "\n");
    const whatsNew = WHATS_NEW_HEADING.exec(norm);
    const head = whatsNew ? norm.slice(0, whatsNew.index) : norm;

    const body = head
        .split("\n")
        .filter(
            (line) =>
                !/^#\s/.test(line) &&
                !line.trim().startsWith(">") &&
                !/^\[?!\[/.test(line.trim())
        )
        .map((line) => line.replace(/^##\s/, "### "))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return body.length > 0 ? body : null;
}

/**
 * Fetch the README's "What's new" section from GitHub. Tries the version tag
 * first, then `master`. Returns `null` on any failure (offline, tag not yet
 * published, section missing) so callers fall back to the bundled localized
 * string.
 *
 * The release checklist requires replacing this README section every release —
 * see docs/development/release-workflow.md.
 */
export async function fetchWhatsNewSection(
    version: string
): Promise<string | null> {
    for (const ref of [version, "master"]) {
        try {
            const response = await requestUrl({
                url: `${GITHUB.RAW_BASE}/${ref}/README.md`,
                method: "GET",
            });
            if (response.status < 200 || response.status >= 300) continue;

            const section = extractWhatsNewSection(response.text);
            if (section) return section;
        } catch {
            // try the next ref
        }
    }

    return null;
}
