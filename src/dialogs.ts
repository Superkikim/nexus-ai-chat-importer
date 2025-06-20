// src/dialogs.ts
import { Modal, App, MarkdownRenderer } from "obsidian";

// Function to show the modal with improved styling
function displayModal(app: App, title: string, paragraphs: string[], note?: string): Modal {
    const modal = new Modal(app);
    modal.contentEl.addClass("nexus-ai-chat-importer-modal");

    // Title with proper styling
    const titleEl = modal.contentEl.createEl("h2", { 
        text: title,
        cls: "modal-title"
    });

    // Content container with proper spacing
    const contentContainer = modal.contentEl.createDiv({ cls: "modal-content" });

    // Render each paragraph with basic HTML parsing for links
    paragraphs.forEach((paragraph) => {
        const paragraphDiv = contentContainer.createDiv({ cls: "modal-paragraph" });
        
        // Simple link detection and conversion
        if (paragraph.includes('[') && paragraph.includes(']') && paragraph.includes('(')) {
            // Convert markdown links to HTML manually
            const htmlContent = paragraph.replace(
                /\[([^\]]+)\]\(([^)]+)\)/g, 
                '<a href="$2" class="external-link" target="_blank">$1</a>'
            );
            paragraphDiv.innerHTML = htmlContent;
        } else {
            // Simple text
            paragraphDiv.createEl("p", { text: paragraph });
        }
    });

    // Note section with emphasis
    if (note) {
        const noteDiv = contentContainer.createDiv({ cls: "modal-note" });
        const noteLabel = noteDiv.createEl("strong", { text: "NOTE: " });
        noteDiv.createSpan({ text: note });
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