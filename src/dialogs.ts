// src/dialogs.ts
import { Modal, App } from "obsidian";

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

    // Render each paragraph with enhanced formatting
    paragraphs.forEach((paragraph) => {
        const paragraphDiv = contentContainer.createDiv({ cls: "modal-paragraph" });
        
        // Split paragraph into lines for better spacing
        const lines = paragraph.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach((line, index) => {
            if (line.includes('[') && line.includes(']') && line.includes('(')) {
                // Convert markdown links to HTML with better formatting
                let htmlContent = line
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="external-link" target="_blank">$1</a>')
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // Bold text
                    .replace(/\*([^*]+)\*/g, '<em>$1</em>');  // Italic text
                
                const lineDiv = paragraphDiv.createDiv({ cls: "modal-line" });
                lineDiv.innerHTML = htmlContent;
            } else {
                // Handle plain text lines
                const lineDiv = paragraphDiv.createDiv({ cls: "modal-line" });
                
                // Check for special formatting (like "Resources:")
                if (line.trim().endsWith(':') && line.trim().length < 20) {
                    lineDiv.innerHTML = `<strong>${line}</strong>`;
                } else if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                    lineDiv.innerHTML = line;
                    lineDiv.addClass('modal-list-item');
                } else {
                    lineDiv.textContent = line;
                }
            }
        });
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