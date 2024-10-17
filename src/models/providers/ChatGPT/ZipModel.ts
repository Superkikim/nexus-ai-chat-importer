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
        // Updated regex for the filename structure
        this.validFilenamePattern =
            /^[a-f0-9]{64}-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/; // Regex for UUID and timestamp
    }

    validate(zipContents: string[], zipFilename: string): boolean {
        const validFilename = this.validFilenamePattern.test(zipFilename);

        // Extract date components if valid
        const match = zipFilename.match(
            /^([a-f0-9]{64})-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.zip$/
        );
        const allFilesPresent = Object.values(this.expectedFiles).every(
            (file) => zipContents.includes(file)
        );

        if (match) {
            const month = parseInt(match[3]);
            const day = parseInt(match[4]);

            // Validate month (1-12) and day (1-31)
            const isValidMonth = month >= 1 && month <= 12;
            const isValidDay = day >= 1 && day <= 31; // Further validation can be added for each month

            return (
                validFilename && isValidMonth && isValidDay && allFilesPresent
            );
        }

        return false; // If regex match fails, return false
    }
}
