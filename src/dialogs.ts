// src/dialogs.ts
import { Modal, App } from "obsidian";

// Function to show the modal with improved spacing
function displayModal(app: App, title: string, paragraphs: string[], note?: string): Modal {
    const modal = new Modal(app);
    modal.contentEl.addClass("nexus-ai-chat-importer-modal");

    // Title with reduced top spacing
    const titleEl = modal.contentEl.createEl("h2", { 
        text: title,
        cls: "modal-title"
    });

    // Content container
    const contentContainer = modal.contentEl.createDiv({ cls: "modal-content" });

    // Process paragraphs with automatic spacing
    paragraphs.forEach((paragraph, paragraphIndex) => {
        // Add double line breaks to ensure sections are separated
        const paragraphWithSpacing = paragraph + '\n\n';
        
        const paragraphDiv = contentContainer.createDiv({ cls: "modal-paragraph" });
        
        // Split into sections (double line breaks create new sections)
        const sections = paragraphWithSpacing.split('\n\n').filter(section => section.trim() !== '');
        
        sections.forEach((section, sectionIndex) => {
            const sectionDiv = paragraphDiv.createDiv({ cls: "modal-section" });
            
            // Process each line within the section
            const lines = section.split('\n').filter(line => line.trim() !== '');
            
            lines.forEach((line) => {
                const lineDiv = sectionDiv.createDiv({ cls: "modal-line" });
                
                // Convert markdown formatting to HTML
                let htmlContent = line
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="external-link" target="_blank">$1</a>')
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
                
                // Check for special formatting
                if (line.trim().endsWith(':') && line.trim().length < 30) {
                    lineDiv.innerHTML = `<strong class="section-header">${htmlContent}</strong>`;
                } else if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                    lineDiv.innerHTML = htmlContent;
                    lineDiv.addClass('modal-list-item');
                } else {
                    lineDiv.innerHTML = htmlContent;
                }
            });
            
            // Add spacing between sections within paragraph
            if (sectionIndex < sections.length - 1) {
                paragraphDiv.createDiv({ cls: "modal-section-break" });
            }
        });
    });

    // Handle note as separate section with spacing
    if (note) {
        // Add spacing before note
        contentContainer.createDiv({ cls: "modal-major-break" });
        
        const noteDiv = contentContainer.createDiv({ cls: "modal-note" });
        
        // Process note content with same formatting
        let noteContent = note
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="external-link" target="_blank">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        noteDiv.innerHTML = noteContent;
    }

    return modal;
}

// Function to add buttons with better styling
function addButtons(
    modal: Modal, 
    type: "information" | "confirmation", 
    resolve: (value: boolean) => void,
    customLabels?: { button1?: string; button2?: string }
): void {
    const buttonContainer = modal.contentEl.createDiv({ cls: "modal-button-container" });
    
    if (type === "information") {
        const buttonLabel = customLabels?.button1 || "Understood";
        const button = buttonContainer.createEl("button", { 
            text: buttonLabel,
            cls: "mod-cta"  // Obsidian's primary button class
        });
        button.addEventListener("click", () => {
            modal.close();
            resolve(true);
        });
    } else { // "confirmation"
        const noLabel = customLabels?.button2 || "No";
        const yesLabel = customLabels?.button1 || "Yes";
        
        // No button (secondary)
        const noButton = buttonContainer.createEl("button", { 
            text: noLabel,
            cls: "mod-muted"  // Obsidian's secondary button class
        });
        noButton.addEventListener("click", () => {
            modal.close();
            resolve(false);
        });
        
        // Yes button (primary)
        const yesButton = buttonContainer.createEl("button", { 
            text: yesLabel,
            cls: "mod-cta"  // Obsidian's primary button class
        });
        yesButton.addEventListener("click", () => {
            modal.close();
            resolve(true);
        });
    }
}

// Main function to show confirmation or information dialog
export async function showDialog(
    app: App,
    type: "information" | "confirmation",
    title: string,
    paragraphs: string[],
    note?: string,
    customLabels?: { button1?: string; button2?: string }
): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = displayModal(app, title, paragraphs, note);
        addButtons(modal, type, resolve, customLabels);
        modal.open();
    });
}

/**
 * Beautiful upgrade dialog with enhanced styling (like Excalidraw)
 */
export async function showUpgradeDialog(
    app: App,
    options: {
        title: string;
        message: string;
        buttons: Array<{ text: string; value: string; primary?: boolean }>;
    }
): Promise<string> {
    return new Promise((resolve) => {
        const modal = new BeautifulUpgradeDialog(app, options, resolve);
        modal.open();
    });
}

class BeautifulUpgradeDialog extends Modal {
    private resolve: (value: string) => void;
    private options: {
        title: string;
        message: string;
        buttons: Array<{ text: string; value: string; primary?: boolean }>;
    };

    constructor(
        app: App,
        options: {
            title: string;
            message: string;
            buttons: Array<{ text: string; value: string; primary?: boolean }>;
        },
        resolve: (value: string) => void
    ) {
        super(app);
        this.options = options;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Add custom CSS class for styling
        contentEl.addClass('nexus-upgrade-dialog');

        // Create main container
        const container = contentEl.createDiv('nexus-upgrade-container');

        // Header with icon and title
        const header = container.createDiv('nexus-upgrade-header');
        const headerIcon = header.createDiv('nexus-upgrade-icon');
        headerIcon.innerHTML = '🚀';
        const headerTitle = header.createDiv('nexus-upgrade-title');
        headerTitle.textContent = this.options.title;

        // Content area with rich formatting
        const content = container.createDiv('nexus-upgrade-content');
        content.innerHTML = this.options.message;

        // Ko-fi support section (like Excalidraw)
        const supportSection = container.createDiv('nexus-support-section');
        supportSection.innerHTML = `
            <div class="nexus-support-text">
                I build this plugin in my free time, as a labor of love. If you find it valuable, say THANK YOU or…
            </div>
            <div class="nexus-coffee-div">
                <a href="https://ko-fi.com/superkikim" target="_blank">
                    <img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com" height="45">
                </a>
            </div>
        `;

        // Buttons container
        const buttonsContainer = container.createDiv('nexus-upgrade-buttons');

        this.options.buttons.forEach(button => {
            const btn = buttonsContainer.createEl('button', {
                text: button.text,
                cls: button.primary ? 'nexus-btn-primary' : 'nexus-btn-secondary'
            });

            btn.addEventListener('click', () => {
                this.close();
                this.resolve(button.value);
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}