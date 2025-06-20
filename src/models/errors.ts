// src/models/errors.ts
export class NexusAiChatImporterError extends Error {
    constructor(message: string, public details?: any) {
        super(message);
        this.name = "NexusAiChatImporterError";
    }
}