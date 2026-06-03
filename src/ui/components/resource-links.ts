/**
 * Reusable resource links grid component
 * Used in installation welcome dialog, upgrade complete modal, new version modal.
 * All styles are defined in styles.css under "RESOURCE LINKS" section.
 */
import { t } from "../../i18n";
import {
    getCommunityForumUrl,
    getIssuesUrl,
    getLocalizedDocsUrl,
    getReleaseNotesUrl,
} from "../../utils/support-links";

/**
 * Render a responsive 4-card grid linking to plugin resources.
 * 2 columns on wide layouts, 1 column when space is constrained.
 */
export function createResourceLinks(container: HTMLElement): void {
    const grid = container.createDiv({ cls: "nexus-resource-links" });

    const resources = [
        {
            icon: "📖",
            title: t("welcome.resources.documentation.title"),
            description: t("welcome.resources.documentation.description"),
            url: getLocalizedDocsUrl(),
        },
        {
            icon: "📝",
            title: t("welcome.resources.release_notes.title"),
            description: t("welcome.resources.release_notes.description"),
            url: getReleaseNotesUrl(),
        },
        {
            icon: "🐛",
            title: t("welcome.resources.report_issues.title"),
            description: t("welcome.resources.report_issues.description"),
            url: getIssuesUrl(),
        },
        {
            icon: "💬",
            title: t("welcome.resources.community_forum.title"),
            description: t("welcome.resources.community_forum.description"),
            url: getCommunityForumUrl(),
        },
    ];

    for (const resource of resources) {
        const card = grid.createEl("a", { cls: "nexus-resource-card" });

        card.createDiv({
            cls: "nexus-resource-card-icon",
            text: resource.icon,
        });
        card.createDiv({
            cls: "nexus-resource-card-title",
            text: resource.title,
        });
        card.createDiv({
            cls: "nexus-resource-card-desc",
            text: resource.description,
        });

        card.addEventListener("click", (e) => {
            e.preventDefault();
            window.open(resource.url, "_blank");
        });
    }
}
