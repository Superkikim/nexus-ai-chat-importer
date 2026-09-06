import { requestUrl } from "obsidian";
import { GITHUB } from "../config/constants";

/**
 * Pull the body of the `## Version X.Y.Z …` section out of a RELEASE_NOTES.md
 * text, without its heading and without the leading shields.io badge line(s).
 * Returns `null` when the section is not present.
 *
 * This is the same section shape `release.yml` extracts for the GitHub Release
 * body, so the dialogs and the release show the same text.
 */
export function extractReleaseNotesSection(
    text: string,
    version: string
): string | null {
    const norm = text.replace(/\r\n/g, "\n");
    const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const start = new RegExp(`^## Version ${escaped}\\b[^\\n]*\\n`, "m").exec(
        norm
    );
    if (!start) return null;

    const rest = norm.slice(start.index + start[0].length);
    const next = rest.search(/^## Version /m);
    const body = next === -1 ? rest : rest.slice(0, next);

    const cleaned = stripBadgeIntro(body).trim();
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * Fetch the current version's RELEASE_NOTES section from GitHub. Tries the
 * version tag first, then `master`. Returns `null` on any failure (offline,
 * tag not yet published, section missing) so callers can fall back to the
 * bundled localized string.
 */
export async function fetchReleaseNotesSection(
    version: string
): Promise<string | null> {
    for (const ref of [version, "master"]) {
        try {
            const response = await requestUrl({
                url: `${GITHUB.RAW_BASE}/${ref}/RELEASE_NOTES.md`,
                method: "GET",
            });
            if (response.status < 200 || response.status >= 300) continue;

            const section = extractReleaseNotesSection(response.text, version);
            if (section) return section;
        } catch {
            // try the next ref
        }
    }

    return null;
}

/** Drop leading blank lines and markdown image-badge line(s) from a section. */
function stripBadgeIntro(section: string): string {
    const lines = section.split(/\r?\n/);
    const badgeLine = /^\s*(?:!\[[^\]]*\]\([^)]*\)\s*)+$/;
    let i = 0;
    while (
        i < lines.length &&
        (lines[i].trim() === "" || badgeLine.test(lines[i]))
    ) {
        i++;
    }
    return lines.slice(i).join("\n");
}
