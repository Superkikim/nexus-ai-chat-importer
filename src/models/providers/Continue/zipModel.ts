// src/models/providers/Continue/ZipModel.ts

// This class represents a model for providers that do not use ZIP files.
export class ContinueZipModel {
    public static isZipModel: boolean = false; // Indicates that this provider does not utilize ZIP files

    private message?: string;

    constructor() {
        this.message = "This provider does not have a ZIP file structure.";
    }

    validate(): boolean {
        // Validation could be extended if needed
        return true; // Placeholder for actual validation logic
    }

    getMessage(): string {
        return this.message || "No additional information.";
    }
}
