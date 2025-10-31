import { App, Modal } from "obsidian";
import { createKofiSupportBox } from "../ui/components/kofi-support-box";

/**
 * Welcome dialog shown on first installation
 */
export class InstallationWelcomeDialog extends Modal {
    private version: string;

    constructor(app: App, version: string) {
        super(app);
        this.version = version;
    }

    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        // Add class to modal
        modalEl.addClass('nexus-installation-welcome-dialog');
        contentEl.addClass('nexus-installation-welcome-dialog');

        // Set modal width
        modalEl.style.width = '600px';
        modalEl.style.maxWidth = '90vw';

        // Set title
        titleEl.setText(`Nexus AI Chat Importer ${this.version}`);

        // Welcome message
        const welcomeSection = contentEl.createDiv('welcome-section');
        welcomeSection.style.cssText = `
            text-align: center;
            margin-bottom: 24px;
        `;

        const welcomeIcon = welcomeSection.createDiv();
        welcomeIcon.innerHTML = '🎉';
        welcomeIcon.style.cssText = `
            font-size: 48px;
            margin-bottom: 12px;
        `;

        const welcomeTitle = welcomeSection.createEl('h2');
        welcomeTitle.textContent = 'Thank you for installing Nexus AI Chat Importer!';
        welcomeTitle.style.cssText = `
            margin: 0 0 12px 0;
            color: var(--text-normal);
        `;

        const welcomeText = welcomeSection.createDiv();
        welcomeText.textContent = 'Import and manage your ChatGPT and Claude conversations directly in your Obsidian vault.';
        welcomeText.style.cssText = `
            color: var(--text-muted);
            line-height: 1.6;
            font-size: 1.05em;
        `;

        // Ko-fi support box (using reusable component)
        createKofiSupportBox(contentEl);

        // Resources section
        const resourcesSection = contentEl.createDiv('resources-section');
        resourcesSection.style.cssText = `
            margin-top: 24px;
        `;

        const resourcesTitle = resourcesSection.createEl('h3');
        resourcesTitle.textContent = 'Resources';
        resourcesTitle.style.cssText = `
            margin: 0 0 16px 0;
            color: var(--text-normal);
            font-size: 1.1em;
        `;

        // Resources grid
        const resourcesGrid = resourcesSection.createDiv('resources-grid');
        resourcesGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        `;

        // Resource links
        const resources = [
            {
                icon: '📖',
                title: 'Documentation',
                description: 'Learn how to use the plugin',
                url: 'https://github.com/superkikim/nexus-ai-chat-importer/blob/1.3.0/README.md'
            },
            {
                icon: '📝',
                title: 'Release Notes',
                description: 'What\'s new in this version',
                url: 'https://github.com/superkikim/nexus-ai-chat-importer/blob/1.3.0/RELEASE_NOTES.md'
            },
            {
                icon: '🐛',
                title: 'Report Issues',
                description: 'Found a bug? Let us know',
                url: 'https://github.com/superkikim/nexus-ai-chat-importer/issues'
            },
            {
                icon: '💬',
                title: 'Community Forum',
                description: 'Join the discussion',
                url: 'https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-and-claude-conversations-to-your-vault/71664'
            }
        ];

        resources.forEach(resource => {
            const card = this.createResourceCard(resourcesGrid, resource);
            resourcesGrid.appendChild(card);
        });

        // Close button
        const buttonContainer = contentEl.createDiv('button-container');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: center;
            margin-top: 24px;
        `;

        const closeButton = buttonContainer.createEl('button', {
            text: 'Get Started'
        });
        closeButton.addClass('mod-cta');
        closeButton.style.cssText = `
            padding: 10px 32px;
            font-size: 1.05em;
        `;

        closeButton.addEventListener('click', () => {
            this.close();
        });
    }

    /**
     * Create a resource card
     */
    private createResourceCard(container: HTMLElement, resource: {
        icon: string;
        title: string;
        description: string;
        url: string;
    }): HTMLElement {
        const card = container.createEl('a', {
            href: resource.url
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
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = 'var(--interactive-accent)';
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.borderColor = 'var(--background-modifier-border)';
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        });

        // Icon
        const icon = card.createDiv();
        icon.innerHTML = resource.icon;
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
        card.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(resource.url, '_blank');
        });

        return card;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

