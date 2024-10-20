// Catalog interface definition
interface CatalogEntry {
    conversation_id: string;
    create_time: string;
    update_time: string;
    provider: string;
    notePath: string;
    messageCount: number;
    fileHash: string;
}

// Provider interface definition
interface Provider {
    name: string;
    file_format: {
        type: "zip" | "json"; // Only "zip" or "json" are valid types
        filename_regex: string;
        required_files: string[];
    };
    conversation: {
        file: string | null; // Conversation file name, null if not applicable
        schema: {
            required_fields: {
                conversation_id: string;
                conversation_model: string | null; // Can be null or "Unspecified"
                create_time: {
                    field: string | null; // Can be null
                    format: string | null; // Can be null
                };
                update_time: {
                    field: string | null; // Can be null
                    format: string | null; // Can be null
                };
                chat_messages: string;
            };
            message_schema: {
                message_id: string;
                role: string;
                message_content: string;
                created_at: {
                    field: string | null; // Can be null
                    format: string | null; // Can be null
                };
                updated_at: {
                    field: string | null; // Can be null
                    format: string | null; // Can be null
                };
                message_model: string | null; // Can be null or "Unspecified"
            };
        };
    };
}

export { CatalogEntry, Provider };
