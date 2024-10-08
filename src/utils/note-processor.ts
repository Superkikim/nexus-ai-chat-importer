// src/utils/note-processor.ts

import {
    NewConversation,
    UpdateConversation,
    SkippedConversation,
} from "./conversation-processor";
import {
    writeToFile,
    generateFilePath,
    getExistingFilePath,
} from "./file-utils";
import { formatTimestamp } from "./date-utils";
import { App } from "obsidian";
import { updateExistingNoteContents } from "./note-utils";

export async function processNewConversations(
    newConversations: NewConversation[],
    app: App
) {
    for (const conversation of newConversations) {
        const content = generateMarkdownContent(conversation);
        const filePath = await generateFilePath(
            conversation.title,
            conversation.create_time,
            app
        ); // Assume this function exists
        await writeToFile(filePath, content, app);
    }
}

export async function processUpdateConversations(
    updateConversations: UpdateConversation[],
    app: App
) {
    for (const update of updateConversations) {
        const filePath = await getExistingFilePath(update.id, app); // Use a method to get the path of the existing file
        await updateExistingNoteContents(filePath, update); // Implement the note updating
    }
}

export function processSkippedConversations(
    skippedConversations: SkippedConversation[]
) {
    // Logic to gather information for the report on skipped notes
    skippedConversations.forEach((conversation) => {
        console.log(
            `Skipped: ${conversation.title} - Reason: ${conversation.reason}`
        );
    });
}

// Additional necessary utility functions
function generateMarkdownContent(conversation: NewConversation): string {
    // Implement this function to generate markdown content based on the NewConversation data
    return ""; // Return the markdown content as a string
}

// ...(Any other utility function needed, e.g., for getting paths)
