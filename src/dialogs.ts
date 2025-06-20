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
        
        // Split into logical sections (double line breaks create new sections)
        const sections = paragraph.split('\n\n').filter(section => section.trim() !== '');
        
        sections.forEach((section, sectionIndex) => {
            const sectionDiv = paragraphDiv.createDiv({ cls: "modal-section" });
            
            // Process each line within the section
            const lines = section.split('\n').filter(line => line.trim() !== '');
            
            lines.forEach((line, lineIndex) => {
                const lineDiv = sectionDiv.createDiv({ cls: "modal-line" });
                
                // Convert markdown formatting to HTML
                let htmlContent = line
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="external-link" target="_blank">$1</a>')
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // Bold text
                    .replace(/\*([^*]+)\*/g, '<em>$1</em>');  // Italic text
                
                // Check for special formatting
                if (line.trim().endsWith(':') && line.trim().length < 30) {
                    // Section headers like "Resources:"
                    lineDiv.innerHTML = `<strong class="section-header">${htmlContent}</strong>`;
                } else if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                    // List items
                    lineDiv.innerHTML = htmlContent;
                    lineDiv.addClass('modal-list-item');
                } else {
                    // Regular content
                    lineDiv.innerHTML = htmlContent;
                }
            });
            
            // Add extra spacing between sections (except after the last one)
            if (sectionIndex < sections.length - 1) {
                paragraphDiv.createDiv({ cls: "modal-section-break" });
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