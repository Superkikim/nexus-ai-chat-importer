// models/nexus-ai-chat-importer-error.ts

export class NexusAiChatImporterError extends Error {
    constructor(message: string, public details?: any) {
        super(message);
        this.name = "NexusAiChatImporterError";
    }
}
