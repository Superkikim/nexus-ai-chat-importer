import { App, Component, MarkdownRenderer, Modal, requestUrl } from "obsidian";
import { createSupportBox } from "../ui/components/support-box";
import { createResourceLinks } from "../ui/components/resource-links";
import { t } from "../i18n";
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

        const resourcesTitle = resourcesSection.createEl("h3");
        resourcesTitle.textContent = t("welcome.resources_title");
        resourcesTitle.style.cssText = `
            margin: 0 0 8px 0;
            color: var(--text-normal);
            font-size: 1.1em;
        `;

        createResourceLinks(resourcesSection);

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
        const readmeText = await this.fetchReadme();
        if (!readmeText) return;

        const overviewMatch = readmeText.match(
            /## Overview\s+([\s\S]*?)(?=\n## |\n# |$)/
        );
        if (!overviewMatch?.[1]) return;

        const renderComponent = new Component();
        renderComponent.load();
        await MarkdownRenderer.render(
            this.app,
            overviewMatch[1].trim(),
            container,
            "",
            renderComponent
        );
    }

    private async fetchReadme(): Promise<string | null> {
        for (const ref of [this.version, "master"]) {
            try {
                const response = await requestUrl({
                    url: `${GITHUB.RAW_BASE}/${ref}/README.md`,
                    method: "GET",
                });
                if (response.status >= 200 && response.status < 300) {
                    return response.text;
                }
            } catch {
                // try next ref
            }
        }
        return null;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
