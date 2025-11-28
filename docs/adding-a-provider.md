# Adding a New Provider to Nexus AI Chat Importer

This guide explains how to add support for a new AI chat provider (e.g., Mistral Le Chat, Google Gemini, etc.) to the Nexus AI Chat Importer plugin.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Provider Structure](#provider-structure)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Testing Your Provider](#testing-your-provider)
5. [Best Practices](#best-practices)

---

## Architecture Overview

The plugin uses a **provider adapter pattern** to support multiple AI chat services. All providers convert their specific format to a standardized format before processing:

```
Provider-Specific Format → ProviderAdapter → StandardConversation → Formatters → Markdown
```

### Key Components

- **`ProviderAdapter<TChat>`** - Interface that all providers must implement
- **`StandardConversation`** - Unified conversation format
- **`StandardMessage`** - Unified message format
- **`StandardAttachment`** - Unified attachment format
- **`BaseProviderAdapter`** - Abstract base class with common functionality

---

## Provider Structure

Each provider follows a standardized directory structure:

```
src/providers/<provider-name>/
├── <provider>-adapter.ts           # Main adapter (extends BaseProviderAdapter)
├── <provider>-converter.ts         # Converts to StandardConversation
├── <provider>-attachment-extractor.ts  # Extracts attachments from ZIP
├── <provider>-report-naming.ts     # Report naming strategy
└── <provider>-types.ts             # TypeScript types for provider format
```

### Example: Mistral Le Chat

```
src/providers/mistral/
├── mistral-adapter.ts
├── mistral-converter.ts
├── mistral-attachment-extractor.ts
├── mistral-report-naming.ts
└── mistral-types.ts
```

---

## Step-by-Step Implementation

### Step 1: Define Provider Types

Create `<provider>-types.ts` to define the structure of the provider's export format.

**Example: `src/providers/mistral/mistral-types.ts`**

```typescript
// Define the structure of Mistral's conversation export
export interface MistralMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    attachments?: MistralAttachment[];
}

export interface MistralConversation {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    messages: MistralMessage[];
    model?: string;
}

export interface MistralAttachment {
    id: string;
    filename: string;
    content_type: string;
    size: number;
}

// Export data structure (what's in the ZIP file)
export interface MistralExportData {
    conversations: MistralConversation[];
}

// Alias for compatibility with ProviderAdapter
export type MistralChat = MistralConversation;
```

---

### Step 2: Create the Converter

Create `<provider>-converter.ts` to convert provider-specific format to `StandardConversation`.

**Example: `src/providers/mistral/mistral-converter.ts`**

```typescript
import { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import { MistralConversation, MistralMessage } from "./mistral-types";
import { sortMessagesByTimestamp } from "../../utils/message-utils";

export class MistralConverter {
    /**
     * Convert Mistral conversation to StandardConversation
     */
    static convertChat(chat: MistralConversation): StandardConversation {
        const messages = this.convertMessages(chat.messages);

        return {
            id: chat.id,
            title: chat.title || "Untitled",
            createTime: this.parseTimestamp(chat.created_at),
            updateTime: this.parseTimestamp(chat.updated_at),
            messages: sortMessagesByTimestamp(messages), // Use shared utility
            provider: "mistral",
            chatUrl: `https://chat.mistral.ai/chat/${chat.id}`,
            metadata: {
                model: chat.model || "mistral-large"
            }
        };
    }

    /**
     * Convert Mistral messages to StandardMessage array
     */
    private static convertMessages(messages: MistralMessage[]): StandardMessage[] {
        return messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: this.parseTimestamp(msg.created_at),
            attachments: msg.attachments ? this.convertAttachments(msg.attachments) : undefined
        }));
    }

    /**
     * Convert Mistral attachments to StandardAttachment array
     */
    private static convertAttachments(attachments: any[]): StandardAttachment[] {
        return attachments.map(att => ({
            fileName: att.filename,
            fileSize: att.size,
            fileType: att.content_type,
            fileId: att.id,
            attachmentType: 'file'
        }));
    }

    /**
     * Parse ISO 8601 timestamp to Unix seconds
     */
    private static parseTimestamp(timestamp: string): number {
        return Math.floor(new Date(timestamp).getTime() / 1000);
    }
}
```

---

### Step 3: Create the Attachment Extractor

Create `<provider>-attachment-extractor.ts` to handle attachment extraction from ZIP files.

**Example: `src/providers/mistral/mistral-attachment-extractor.ts`**

```typescript
import JSZip from "jszip";
import { StandardAttachment } from "../../types/standard";
import { AttachmentExtractor } from "../base/base-provider-adapter";
import type NexusAiChatImporterPlugin from "../../main";
import { Logger } from "../../logger";

export class MistralAttachmentExtractor implements AttachmentExtractor {
    constructor(
        private plugin: NexusAiChatImporterPlugin,
        private logger: Logger
    ) {}

    async extractAttachments(
        zip: JSZip,
        conversationId: string,
        attachments: any[],
        messageId?: string
    ): Promise<StandardAttachment[]> {
        const processedAttachments: StandardAttachment[] = [];

        for (const attachment of attachments) {
            try {
                // Look for attachment in ZIP (adjust path based on Mistral's structure)
                const zipPath = `attachments/${attachment.id}`;
                const zipFile = zip.file(zipPath);

                if (zipFile) {
                    // Extract and save to vault
                    const content = await zipFile.async('uint8array');
                    const localPath = await this.saveAttachment(
                        conversationId,
                        attachment.filename,
                        content
                    );

                    processedAttachments.push({
                        ...attachment,
                        status: {
                            processed: true,
                            found: true,
                            localPath
                        }
                    });
                } else {
                    // Attachment not found in ZIP
                    processedAttachments.push({
                        ...attachment,
                        status: {
                            processed: true,
                            found: false,
                            reason: 'missing_from_export'
                        }
                    });
                }
            } catch (error) {
                this.logger.error(`Failed to extract attachment ${attachment.filename}:`, error);
                processedAttachments.push({
                    ...attachment,
                    status: {
                        processed: true,
                        found: false,
                        reason: 'extraction_failed'
                    }
                });
            }
        }

        return processedAttachments;
    }

    private async saveAttachment(
        conversationId: string,
        fileName: string,
        content: Uint8Array
    ): Promise<string> {
        const attachmentFolder = this.plugin.settings.attachmentFolder;
        const filePath = `${attachmentFolder}/mistral/images/${fileName}`;
        
        await this.plugin.fileService.createOrUpdateFile(filePath, content);
        return filePath;
    }
}
```

---

### Step 4: Create the Report Naming Strategy

Create `<provider>-report-naming.ts` to define how import reports are named.

**Example: `src/providers/mistral/mistral-report-naming.ts`**

```typescript
import { ReportNamingStrategy } from "../../types/standard";
import { extractReportPrefixFromZip } from "../../utils/report-naming-utils";

export class MistralReportNamingStrategy implements ReportNamingStrategy {
    getProviderName(): string {
        return "mistral";
    }

    extractReportPrefix(zipFileName: string): string {
        // Mistral date patterns (adjust based on actual export format)
        const patterns = [
            /mistral-export-(\d{4})-(\d{2})-(\d{2})/,  // mistral-export-2025-04-25.zip
            /(\d{4})-(\d{2})-(\d{2})/                   // Generic YYYY-MM-DD
        ];
        return extractReportPrefixFromZip(zipFileName, patterns);
    }

    getProviderSpecificColumn(): { header: string; getValue: (adapter: any, chat: any) => number } {
        return {
            header: "Attachments",
            getValue: (adapter: any, chat: any) => {
                // Count attachments in Mistral conversation
                return chat.messages?.reduce((count: number, msg: any) => {
                    return count + (msg.attachments?.length || 0);
                }, 0) || 0;
            }
        };
    }
}
```

---

### Step 5: Create the Main Adapter

Create `<provider>-adapter.ts` that extends `BaseProviderAdapter`.

**Example: `src/providers/mistral/mistral-adapter.ts`**

```typescript
import { StandardConversation } from "../../types/standard";
import { MistralConverter } from "./mistral-converter";
import { MistralAttachmentExtractor } from "./mistral-attachment-extractor";
import { MistralReportNamingStrategy } from "./mistral-report-naming";
import { MistralConversation, MistralMessage } from "./mistral-types";
import type NexusAiChatImporterPlugin from "../../main";
import { BaseProviderAdapter, AttachmentExtractor } from "../base/base-provider-adapter";

export class MistralAdapter extends BaseProviderAdapter<MistralConversation> {
    private attachmentExtractor: MistralAttachmentExtractor;
    private reportNamingStrategy: MistralReportNamingStrategy;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        super(); // IMPORTANT: Call parent constructor
        this.attachmentExtractor = new MistralAttachmentExtractor(plugin, plugin.logger);
        this.reportNamingStrategy = new MistralReportNamingStrategy();
    }

    /**
     * Detect if raw data is from Mistral
     */
    detect(rawConversations: any[]): boolean {
        if (rawConversations.length === 0) return false;
        
        const sample = rawConversations[0];
        
        // Mistral detection: check for specific fields
        // Adjust based on actual Mistral export structure
        return !!(
            sample.id &&
            sample.messages &&
            Array.isArray(sample.messages) &&
            sample.created_at &&
            sample.updated_at
        );
    }

    getId(chat: MistralConversation): string {
        return chat.id || "";
    }

    getTitle(chat: MistralConversation): string {
        return chat.title || "Untitled";
    }

    getCreateTime(chat: MistralConversation): number {
        return chat.created_at ? Math.floor(new Date(chat.created_at).getTime() / 1000) : 0;
    }

    getUpdateTime(chat: MistralConversation): number {
        return chat.updated_at ? Math.floor(new Date(chat.updated_at).getTime() / 1000) : 0;
    }

    convertChat(chat: MistralConversation): StandardConversation {
        return MistralConverter.convertChat(chat);
    }

    getProviderName(): string {
        return "mistral";
    }

    getNewMessages(chat: MistralConversation, existingMessageIds: string[]): MistralMessage[] {
        const existingIds = new Set(existingMessageIds);
        return chat.messages.filter(msg => !existingIds.has(msg.id));
    }

    getReportNamingStrategy() {
        return this.reportNamingStrategy;
    }

    /**
     * Provide Mistral-specific attachment extractor
     * The actual processMessageAttachments() logic is inherited from BaseProviderAdapter
     */
    protected getAttachmentExtractor(): AttachmentExtractor {
        return this.attachmentExtractor;
    }
}
```

---

### Step 6: Register the Provider

Add your provider to the registry in `src/providers/provider-registry.ts`:

```typescript
import { MistralAdapter } from "./mistral/mistral-adapter";

export function createProviderRegistry(plugin: NexusAiChatImporterPlugin): DefaultProviderRegistry {
    const registry = new DefaultProviderRegistry();

    registry.register("chatgpt", new ChatGPTAdapter(plugin));
    registry.register("claude", new ClaudeAdapter(plugin));
    registry.register("mistral", new MistralAdapter(plugin));  // Add your provider

    return registry;
}
```

---

### Step 7: Add to Provider Selection Dialog

Update `src/dialogs/provider-selection-dialog.ts` to include your provider:

```typescript
private getAvailableProviders(registry: ProviderRegistry): ProviderInfo[] {
    const providers: ProviderInfo[] = [];
    
    // ... existing providers ...
    
    // Mistral
    if (registry.getAdapter("mistral")) {
        providers.push({
            id: "mistral",
            name: "Mistral Le Chat",
            description: "Mistral AI conversation exports",
            fileFormats: ["conversations.json"]
        });
    }
    
    return providers;
}
```

---

### Step 8: Add Provider URL

Update `src/config/constants.ts` to add your provider's URL:

```typescript
export const PROVIDER_URLS = {
    CHATGPT: {
        BASE: 'https://chatgpt.com',
        CHAT: (id: string) => `https://chatgpt.com/c/${id}`
    },
    CLAUDE: {
        BASE: 'https://claude.ai',
        CHAT: (id: string) => `https://claude.ai/chat/${id}`
    },
    MISTRAL: {
        BASE: 'https://chat.mistral.ai',
        CHAT: (id: string) => `https://chat.mistral.ai/chat/${id}`
    }
} as const;
```

---

## Testing Your Provider

### 1. Unit Tests

Create tests for your converter and utilities:

```typescript
// src/providers/mistral/mistral-converter.test.ts
import { describe, it, expect } from 'vitest';
import { MistralConverter } from './mistral-converter';

describe('MistralConverter', () => {
    it('should convert Mistral conversation to StandardConversation', () => {
        const mistralChat = {
            id: 'conv-123',
            title: 'Test Conversation',
            created_at: '2025-04-25T10:00:00Z',
            updated_at: '2025-04-25T11:00:00Z',
            messages: [
                {
                    id: 'msg-1',
                    role: 'user',
                    content: 'Hello',
                    created_at: '2025-04-25T10:00:00Z'
                }
            ]
        };

        const result = MistralConverter.convertChat(mistralChat);

        expect(result.id).toBe('conv-123');
        expect(result.provider).toBe('mistral');
        expect(result.messages).toHaveLength(1);
    });
});
```

### 2. Integration Testing

1. Export a real conversation from Mistral
2. Place the ZIP file in your test vault
3. Run the import command
4. Verify the output Markdown files

---

## Best Practices

### 1. Use Shared Utilities

Always use the shared utilities to avoid code duplication:

```typescript
import { sortMessagesByTimestamp } from "../../utils/message-utils";
import { extractReportPrefixFromZip } from "../../utils/report-naming-utils";
import { sanitizeFileName, formatFileSize } from "../../utils/file-utils";
```

### 2. Extend BaseProviderAdapter

Always extend `BaseProviderAdapter` to inherit common functionality:

```typescript
export class MistralAdapter extends BaseProviderAdapter<MistralConversation> {
    constructor(private plugin: NexusAiChatImporterPlugin) {
        super(); // IMPORTANT: Call parent constructor
        // ... your initialization ...
    }
    
    protected getAttachmentExtractor(): AttachmentExtractor {
        return this.attachmentExtractor;
    }
}
```

### 3. Handle Missing Data Gracefully

Always provide fallbacks for missing data:

```typescript
getTitle(chat: MistralConversation): string {
    return chat.title || "Untitled";  // Fallback to "Untitled"
}

getCreateTime(chat: MistralConversation): number {
    return chat.created_at ? Math.floor(new Date(chat.created_at).getTime() / 1000) : 0;
}
```

### 4. Use ISO 8601 for Timestamps

Always store timestamps in ISO 8601 UTC format in frontmatter:

```typescript
const isoTimestamp = new Date(unixSeconds * 1000).toISOString();
```

### 5. Implement Robust Detection

Make your `detect()` method specific enough to avoid false positives:

```typescript
detect(rawConversations: any[]): boolean {
    if (rawConversations.length === 0) return false;
    
    const sample = rawConversations[0];
    
    // Check for multiple provider-specific fields
    return !!(
        sample.id &&
        sample.messages &&
        Array.isArray(sample.messages) &&
        sample.created_at &&
        // Add more specific checks
        sample.provider_metadata?.mistral_version
    );
}
```

---

## Summary Checklist

When adding a new provider, make sure you:

- [ ] Create provider types (`<provider>-types.ts`)
- [ ] Create converter (`<provider>-converter.ts`)
- [ ] Create attachment extractor (`<provider>-attachment-extractor.ts`)
- [ ] Create report naming strategy (`<provider>-report-naming.ts`)
- [ ] Create main adapter extending `BaseProviderAdapter` (`<provider>-adapter.ts`)
- [ ] Register provider in `provider-registry.ts`
- [ ] Add to provider selection dialog
- [ ] Add provider URL to `constants.ts`
- [ ] Write unit tests
- [ ] Test with real export data
- [ ] Update documentation

---

## Need Help?

- Check existing providers (ChatGPT, Claude) for reference implementations
- Review the [CLAUDE.md](../CLAUDE.md) file for architecture details
- Open an issue on GitHub for questions

Happy coding! 🚀

