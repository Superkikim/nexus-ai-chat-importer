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
