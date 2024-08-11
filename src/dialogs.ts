import {
    Modal,
    App
} from "obsidian";

// Function to show the modal
function displayModal(app: App, title: string, paragraphs: string[], note?: string): Modal {
    const modal = new Modal(app);

    // Format the title
    const titleEl = modal.contentEl.createEl("h2", { text: title });
    titleEl.style.fontSize = "1.5em"; // Make title bigger

    // Format the paragraphs
    paragraphs.forEach(paragraph => {
        const paragraphEl = modal.contentEl.createEl("div");
        paragraphEl.innerHTML = paragraph; // Allow for HTML content
    });

    // Format the optional note
    if (note) {
        const noteEl = modal.contentEl.createEl("p", { text: note.toUpperCase() }); // All caps
        noteEl.style.fontSize = "0.8em"; // Smaller font size
        noteEl.style.color = "#888"; // Optional: lighter color
    }

    return modal;
}

// Function to add buttons based on the type and custom labels
function addButtons(modal: Modal, type: "information" | "confirmation", customLabels?: { button1?: string; button2?: string }, resolve: (value: boolean) => void) {
    const buttonDiv = modal.contentEl.createEl("div", { cls: "modal-button-container" });
    if (type === "information") {
        const buttonLabel = customLabels?.button1 || "Understood";
        const button = buttonDiv.createEl("button", { text: buttonLabel });
        button.addEventListener("click", () => {
            modal.close();
            resolve(true);
        });
    } else { // "confirmation"
        const yesLabel = customLabels?.button1 || "Yes";
        const noLabel = customLabels?.button2 || "No";
        const yesButton = buttonDiv.createEl("button", { text: yesLabel });
        yesButton.addEventListener("click", () => {
            modal.close();
            resolve(true);
        });
        const noButton = buttonDiv.createEl("button", { text: noLabel });
        noButton.addEventListener("click", () => {
            modal.close();
            resolve(false);
        });
    }
    // Center buttons
    buttonDiv.style.display = "flex";
    buttonDiv.style.justifyContent = "center";
}

// Main function to show confirmation or information dialog
export async function showDialog(app: App, type: "information" | "confirmation", title: string, paragraphs: string[], note?: string, customLabels?: { button1?: string; button2?: string }): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = displayModal(app, title, paragraphs, note);
        addButtons(modal, type, customLabels, resolve); // Pass resolve to addButtons
        modal.open();
    });
}
