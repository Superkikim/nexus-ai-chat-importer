// src/models/providers/Claude/ZipModel.ts

interface ClaudeFileStructure {
    usersJson: string;
    conversationsJson: string;
}

export class ClaudeZipModel {
    private expectedFiles: ClaudeFileStructure;
    private validFilenamePattern: RegExp;

    constructor() {
        this.expectedFiles = {
            usersJson: "users.json",
            conversationsJson: "conversations.json",
        };
        // Updated regex to match "data-<Year>-<Month>-<Day>-<Hour>-<Minute>-<Second>.zip"
        this.validFilenamePattern =
            /^data-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/; // Regex for date and time
    }

    validate(zipContents: string[], zipFilename: string): boolean {
        const validFilename = this.validFilenamePattern.test(zipFilename);

        // Extract date and time components
        const match = zipFilename.match(
            /^data-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.zip$/
        );
        const allFilesPresent = Object.values(this.expectedFiles).every(
            (file) => zipContents.includes(file)
        );

        if (match) {
            const month = parseInt(match[2]);
            const day = parseInt(match[3]);

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
