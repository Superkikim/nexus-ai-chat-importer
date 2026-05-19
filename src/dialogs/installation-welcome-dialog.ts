import { App, Component, MarkdownRenderer, Modal, requestUrl } from "obsidian";
import { createSupportBox } from "../ui/components/support-box";
import { t } from "../i18n";
import {
    getCommunityForumUrl,
    getIssuesUrl,
    getLocalizedDocsUrl,
    getReleaseNotesUrl,
} from "../utils/support-links";
import { GITHUB } from "../config/constants";

/**
 * Welcome dialog shown on first installation
 */
export class InstallationWelcomeDialog extends Modal {
    private version: string;
    private onGetStarted?: () => void;

    constructor(app: App, version: string, onGetStarted?: () => void) {
        super(app);
        this.version = version;
        this.onGetStarted = onGetStarted;
    }

    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        // Add class to modal (width is set in styles.css)
        modalEl.addClass("nexus-installation-welcome-dialog");
        contentEl.addClass("nexus-installation-welcome-dialog");

        // Set title
        titleEl.setText(t("welcome.title", { version: this.version }));

        // Welcome message
        const welcomeSection = contentEl.createDiv("welcome-section");
        welcomeSection.style.cssText = `
            text-align: center;
            margin-bottom: 24px;
        `;

        const welcomeIcon = welcomeSection.createDiv();
        welcomeIcon.setText(t("welcome.icon"));
        welcomeIcon.style.cssText = `
            font-size: 48px;
            margin-bottom: 12px;
        `;

        const welcomeTitle = welcomeSection.createEl("h2");
        welcomeTitle.textContent = t("welcome.heading");
        welcomeTitle.style.cssText = `
            margin: 0 0 12px 0;
            color: var(--text-normal);
        `;

        const welcomeText = welcomeSection.createDiv();
        welcomeText.textContent = t("welcome.description");
        welcomeText.style.cssText = `
            color: var(--text-muted);
            line-height: 1.6;
            font-size: 1.05em;
        `;

        // Overview section — fetched async from README
        const overviewEl = contentEl.createDiv({
            cls: "nexus-welcome-overview",
        });
        overviewEl.style.cssText = `margin: 20px 0;`;
        void this.loadOverview(overviewEl);

        // Support box (using reusable component)
        createSupportBox(contentEl);

        // Resources section
        const resourcesSection = contentEl.createDiv("resources-section");
        resourcesSection.style.cssText = `
            margin-top: 24px;
        `;

        const resourcesTitle = resourcesSection.createEl("h3");
        resourcesTitle.textContent = t("welcome.resources_title");
        resourcesTitle.style.cssText = `
            margin: 0 0 16px 0;
            color: var(--text-normal);
            font-size: 1.1em;
        `;

        // Resources grid
        const resourcesGrid = resourcesSection.createDiv("resources-grid");
        resourcesGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        `;

        // Resource links
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

        resources.forEach((resource) => {
            const card = this.createResourceCard(resourcesGrid, resource);
            resourcesGrid.appendChild(card);
        });

        // Close button
        const buttonContainer = contentEl.createDiv("button-container");
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: center;
            margin-top: 24px;
        `;

        const closeButton = buttonContainer.createEl("button", {
            text: t("welcome.buttons.get_started"),
        });
        closeButton.addClass("mod-cta");
        closeButton.style.cssText = `
            padding: 10px 32px;
            font-size: 1.05em;
        `;

        closeButton.addEventListener("click", () => {
            this.close();
            this.onGetStarted?.();
        });
    }

    private async loadOverview(container: HTMLElement) {
        const url = `${GITHUB.RAW_BASE}/master/README.md`;
        console.log("[Nexus] loadOverview: fetching", url);
        try {
            const response = await requestUrl({ url, method: "GET" });
            console.log("[Nexus] loadOverview: status", response.status);
            if (response.status >= 200 && response.status < 300) {
                const overviewMatch = response.text.match(
                    /## Overview\s+([\s\S]*?)(?=\n## |\n# |$)/
                );
                console.log("[Nexus] loadOverview: match", overviewMatch ? "found" : "null");
                if (overviewMatch && overviewMatch[1]) {
                    console.log("[Nexus] loadOverview: rendering", overviewMatch[1].slice(0, 80));
                    const renderComponent = new Component();
                    renderComponent.load();
                    await MarkdownRenderer.render(
                        this.app,
                        overviewMatch[1].trim(),
                        container,
                        "",
                        renderComponent
                    );
                    console.log("[Nexus] loadOverview: render complete");
                }
            }
        } catch (err) {
            console.error("[Nexus] loadOverview: error", err);
        }
    }

    /**
     * Create a resource card
     */
    private createResourceCard(
        container: HTMLElement,
        resource: {
            icon: string;
            title: string;
            description: string;
            url: string;
        }
    ): HTMLElement {
        const card = container.createEl("a", {
            href: resource.url,
        });
        card.style.cssText = `
            display: block;
            padding: 16px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            text-decoration: none;
            color: var(--text-normal);
            transition: all 0.2s;
            background: var(--background-secondary);
        `;

        // Hover effect
        card.addEventListener("mouseenter", () => {
            card.addClass("nexus-card-hover");
        });

        card.addEventListener("mouseleave", () => {
            card.removeClass("nexus-card-hover");
        });

        // Icon
        const icon = card.createDiv();
        icon.setText(resource.icon);
        icon.style.cssText = `
            font-size: 32px;
            margin-bottom: 8px;
        `;

        // Title
        const title = card.createDiv();
        title.textContent = resource.title;
        title.style.cssText = `
            font-weight: 600;
            margin-bottom: 4px;
            color: var(--text-normal);
        `;

        // Description
        const description = card.createDiv();
        description.textContent = resource.description;
        description.style.cssText = `
            font-size: 0.9em;
            color: var(--text-muted);
            line-height: 1.4;
        `;

        // Open in external browser
        card.addEventListener("click", (e) => {
            e.preventDefault();
            window.open(resource.url, "_blank");
        });

        return card;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
