// src/models/providers/ChatGPT/ZipModel.ts

interface ChatGPTFileStructure {
    userJson: string;
    conversationsJson: string;
    messageFeedbackJson: string;
    modelComparisonsJson: string;
    chatHtml: string;
}

export class ChatGPTZipModel {
    private expectedFiles: ChatGPTFileStructure;
    private validFilenamePattern: RegExp;

    constructor() {
        this.expectedFiles = {
            userJson: "user.json",
            conversationsJson: "conversations.json",
            messageFeedbackJson: "message_feedback.json",
            modelComparisonsJson: "model_comparisons.json",
            chatHtml: "chat.html",
        };
        this.validFilenamePattern =
            /^[a-f0-9]{64}-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/; // Regex for UUID and timestamp
    }

    validate(zipContents: string[], zipFilename: string): boolean {
        const validFilename = this.validFilenamePattern.test(zipFilename);
        const allFilesPresent = Object.values(this.expectedFiles).every(
            (file) => zipContents.includes(file)
        );
        return validFilename && allFilesPresent;
    }
}
