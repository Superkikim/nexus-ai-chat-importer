// src/upgrade/versions/upgrade-1.2.0.ts
import { VersionUpgrade, UpgradeOperation, UpgradeContext, OperationResult } from "../upgrade-interface";
import { TFile, Modal, MarkdownRenderer } from "obsidian";
import NexusAiChatImporterPlugin from "../../main";

/**
 * Convert indentations to callouts (automatic operation)
 */
class ConvertToCalloutsOperation extends UpgradeOperation {
    readonly id = "convert-to-callouts";
    readonly name = "Convert to Modern Callouts";
    readonly description = "Transform old indentations (>, >>) to beautiful Nexus callouts";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            
            // Filter conversation files (exclude Reports/Attachments)
            const conversationFiles = allFiles.filter(file => {
                if (!file.path.startsWith(archiveFolder)) return false;
                
                const relativePath = file.path.substring(archiveFolder.length + 1);
                if (relativePath.startsWith('Reports/') || 
                    relativePath.startsWith('Attachments/') ||
                    relativePath.startsWith('reports/') ||
                    relativePath.startsWith('attachments/')) {
                    return false;
                }
                
                return true;
            });

            // Check if any files have old indentation format
            for (const file of conversationFiles.slice(0, 10)) { // Sample first 10 files
                try {
                    const content = await context.plugin.app.vault.read(file);
                    
                    // Check for v1.1.0 format markers
                    if (this.hasOldIndentationFormat(content)) {
                        return true;
                    }
                } catch (error) {
                    console.error(`Error checking file ${file.path}:`, error);
                }
            }
            
            return false;
        } catch (error) {
            console.error(`ConvertToCallouts.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] ConvertToCallouts.execute starting`);
            
            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            
            // Filter conversation files (exclude Reports/Attachments)
            const conversationFiles = allFiles.filter(file => {
                if (!file.path.startsWith(archiveFolder)) return false;
                
                const relativePath = file.path.substring(archiveFolder.length + 1);
                if (relativePath.startsWith('Reports/') || 
                    relativePath.startsWith('Attachments/') ||
                    relativePath.startsWith('reports/') ||
                    relativePath.startsWith('attachments/')) {
                    return false;
                }
                
                return true;
            });

            let processed = 0;
            let converted = 0;
            let errors = 0;

            console.debug(`[NEXUS-DEBUG] ConvertToCallouts: Processing ${conversationFiles.length} files`);

            // Process files in smaller batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < conversationFiles.length; i += batchSize) {
                const batch = conversationFiles.slice(i, i + batchSize);
                
                for (const file of batch) {
                    processed++;

                    try {
                        const content = await context.plugin.app.vault.read(file);
                        
                        // Only process files with old format
                        if (!this.hasOldIndentationFormat(content)) {
                            continue;
                        }
                        
                        const convertedContent = this.convertIndentationsToCallouts(content);

                        if (content !== convertedContent) {
                            // Update plugin_version to 1.2.0
                            const finalContent = this.updatePluginVersion(convertedContent, "1.2.0");
                            await context.plugin.app.vault.modify(file, finalContent);
                            converted++;
                        }

                    } catch (error) {
                        errors++;
                        console.error(`[NEXUS-DEBUG] Error converting ${file.path}:`, error);
                    }
                }

                // Small delay between batches to prevent blocking
                if (i + batchSize < conversationFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            console.debug(`[NEXUS-DEBUG] ConvertToCallouts: Completed - processed:${processed}, converted:${converted}, errors:${errors}`);

            return {
                success: errors === 0,
                message: `Callout conversion completed: ${converted} files converted, ${errors} errors`,
                details: { processed, converted, errors }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] ConvertToCallouts.execute failed:`, error);
            return {
                success: false,
                message: `Callout conversion failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    /**
     * Check if content has old indentation format (v1.1.0)
     */
    private hasOldIndentationFormat(content: string): boolean {
        // Look for patterns that indicate v1.1.0 format
        const oldPatterns = [
            /^### User, on .* at .*;\n>/m,           // User messages with indentation
            /^#### Assistant, on .* at .*;\n>>/m,    // Assistant messages with indentation
            /<div class="nexus-attachment-box">/,    // Old attachment divs
            /<div class="nexus-artifact-box">/,      // Old artifact divs
            />\[!note\] 📎 \*\*Attachment:\*\*/      // Old note callouts for attachments
        ];

        return oldPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Convert old indentations to modern callouts
     */
    private convertIndentationsToCallouts(content: string): string {
        let converted = content;

        // 1. Convert User messages: ### User, on DATE at TIME;\n> content
        converted = converted.replace(
            /^### User, on (.*?) at (.*?);\n((?:> .*(?:\n|$))*)/gm,
            (match, date, time, quotedContent) => {
                const cleanContent = quotedContent.replace(/^> /gm, '> ');
                return `>[!nexus_user] **User** - ${date} at ${time}\n${cleanContent}`;
            }
        );

        // 2. Convert Assistant messages: #### Assistant, on DATE at TIME;\n>> content
        converted = converted.replace(
            /^#### Assistant, on (.*?) at (.*?);\n((?:>> .*(?:\n|$))*)/gm,
            (match, date, time, quotedContent) => {
                const cleanContent = quotedContent.replace(/^>> /gm, '> ');
                return `>[!nexus_agent] **Assistant** - ${date} at ${time}\n${cleanContent}`;
            }
        );

        // 3. Convert attachment divs to callouts (robust pattern)
        converted = converted.replace(
            /<div class="nexus-attachment-box">\s*\n\s*\*\*📎 Attachment:\*\* ([^(]+)\(([^)]+)\)([\s\S]*?)<\/div>/g,
            (match, fileName, fileType, content) => {
                const cleanFileName = fileName.trim();
                let cleanContent = content.trim();

                // Handle different content patterns
                if (cleanContent.includes('**Content:**')) {
                    cleanContent = cleanContent.replace(/\*\*Content:\*\*/g, '').trim();
                }
                if (cleanContent.includes('**Status:**')) {
                    cleanContent = cleanContent.replace(/\*\*Status:\*\*/g, '').trim();
                }

                // Format for callout
                cleanContent = cleanContent.replace(/\n/g, '\n> ').trim();
                if (cleanContent && !cleanContent.startsWith('>')) {
                    cleanContent = '> ' + cleanContent;
                }

                return `>[!nexus_attachment] **${cleanFileName}** (${fileType})\n${cleanContent}`;
            }
        );

        // 4. Convert artifact divs to callouts (enhanced pattern)
        converted = converted.replace(
            /<div class="nexus-artifact-box">\s*([\s\S]*?)\s*<\/div>/g,
            (match, content) => {
                let cleanContent = content.trim();

                // Extract artifact title if present
                const titleMatch = cleanContent.match(/\*\*([^*]+)\*\*/);
                const title = titleMatch ? titleMatch[1] : 'Artifact';

                // Clean and format content
                cleanContent = cleanContent.replace(/\*\*[^*]+\*\*/g, '').trim();
                cleanContent = cleanContent.replace(/\n/g, '\n> ').trim();
                if (cleanContent && !cleanContent.startsWith('>')) {
                    cleanContent = '> ' + cleanContent;
                }

                return `>[!nexus_artifact] **${title}**\n${cleanContent}`;
            }
        );

        // 5. Handle any remaining old-style note callouts that should be attachments
        converted = converted.replace(
            />\[!note\] 📎 \*\*Attachment:\*\* ([^(]+)\(([^)]+)\)(.*?)(?=\n\n|\n>|\n<!--|\n---|$)/gs,
            (match, fileName, fileType, content) => {
                const cleanFileName = fileName.trim();
                let cleanContent = content.trim();
                cleanContent = cleanContent.replace(/\n/g, '\n> ').trim();
                if (cleanContent && !cleanContent.startsWith('>')) {
                    cleanContent = '> ' + cleanContent;
                }
                return `>[!nexus_attachment] **${cleanFileName}** (${fileType})\n${cleanContent}`;
            }
        );

        return converted;
    }

    /**
     * Update plugin_version in frontmatter
     */
    private updatePluginVersion(content: string, version: string): string {
        return content.replace(
            /^plugin_version: ".*?"$/m,
            `plugin_version: "${version}"`
        );
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            
            // Check conversation files (sample verification)
            const conversationFiles = allFiles.filter(file => {
                if (!file.path.startsWith(archiveFolder)) return false;
                
                const relativePath = file.path.substring(archiveFolder.length + 1);
                if (relativePath.startsWith('Reports/') || 
                    relativePath.startsWith('Attachments/') ||
                    relativePath.startsWith('reports/') ||
                    relativePath.startsWith('attachments/')) {
                    return false;
                }
                
                return true;
            }).slice(0, 5); // Check first 5 files

            for (const file of conversationFiles) {
                try {
                    const content = await context.plugin.app.vault.read(file);
                    
                    // Check if still has old format
                    if (this.hasOldIndentationFormat(content)) {
                        console.debug(`[NEXUS-DEBUG] ConvertToCallouts.verify: Still has old format in ${file.path}`);
                        return false;
                    }

                    // Check if plugin_version was updated
                    if (!content.includes('plugin_version: "1.2.0"')) {
                        console.debug(`[NEXUS-DEBUG] ConvertToCallouts.verify: Missing v1.2.0 in ${file.path}`);
                        return false;
                    }

                } catch (error) {
                    console.error(`Error verifying file ${file.path}:`, error);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(`ConvertToCallouts.verify failed:`, error);
            return false;
        }
    }
}

/**
 * Move existing conversations to provider subfolder (automatic operation)
 */
class MoveToProviderFolderOperation extends UpgradeOperation {
    readonly id = "move-to-provider-folder";
    readonly name = "Organize by Provider";
    readonly description = "Move existing conversations to ChatGPT subfolder for better organization";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();

            // Look for conversation files in the old structure (directly in year/month folders)
            const oldStructureFiles = allFiles.filter(file => {
                if (!file.path.startsWith(archiveFolder)) return false;

                const relativePath = file.path.substring(archiveFolder.length + 1);

                // Skip if already in provider subfolder
                if (relativePath.startsWith('ChatGPT/') ||
                    relativePath.startsWith('Claude/') ||
                    relativePath.startsWith('chatgpt/') ||
                    relativePath.startsWith('claude/')) {
                    return false;
                }

                // Skip Reports and Attachments
                if (relativePath.startsWith('Reports/') ||
                    relativePath.startsWith('Attachments/') ||
                    relativePath.startsWith('reports/') ||
                    relativePath.startsWith('attachments/')) {
                    return false;
                }

                // Check if it's in old structure: year/month/file.md
                const pathParts = relativePath.split('/');
                if (pathParts.length >= 3) {
                    const year = pathParts[0];
                    const month = pathParts[1];

                    // Check if year and month look like dates
                    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
                        return true;
                    }
                }

                return false;
            });

            return oldStructureFiles.length > 0;
        } catch (error) {
            console.error(`MoveToProviderFolder.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] MoveToProviderFolder.execute starting`);

            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();

            // Find files in old structure
            const oldStructureFiles = allFiles.filter(file => {
                if (!file.path.startsWith(archiveFolder)) return false;

                const relativePath = file.path.substring(archiveFolder.length + 1);

                // Skip if already in provider subfolder or special folders
                if (relativePath.startsWith('ChatGPT/') ||
                    relativePath.startsWith('Claude/') ||
                    relativePath.startsWith('chatgpt/') ||
                    relativePath.startsWith('claude/') ||
                    relativePath.startsWith('Reports/') ||
                    relativePath.startsWith('Attachments/') ||
                    relativePath.startsWith('reports/') ||
                    relativePath.startsWith('attachments/')) {
                    return false;
                }

                // Check if it's in old structure: year/month/file.md
                const pathParts = relativePath.split('/');
                if (pathParts.length >= 3) {
                    const year = pathParts[0];
                    const month = pathParts[1];

                    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
                        return true;
                    }
                }

                return false;
            });

            let moved = 0;
            let errors = 0;

            console.debug(`[NEXUS-DEBUG] MoveToProviderFolder: Moving ${oldStructureFiles.length} files`);

            for (const file of oldStructureFiles) {
                try {
                    const relativePath = file.path.substring(archiveFolder.length + 1);
                    const newPath = `${archiveFolder}/ChatGPT/${relativePath}`;

                    // Ensure target directory exists
                    const targetDir = newPath.substring(0, newPath.lastIndexOf('/'));
                    await context.plugin.app.vault.adapter.mkdir(targetDir);

                    // Move the file
                    await context.plugin.app.vault.adapter.rename(file.path, newPath);
                    moved++;

                    console.debug(`[NEXUS-DEBUG] Moved: ${file.path} → ${newPath}`);

                } catch (error) {
                    errors++;
                    console.error(`[NEXUS-DEBUG] Error moving ${file.path}:`, error);
                }
            }

            console.debug(`[NEXUS-DEBUG] MoveToProviderFolder: Completed - moved:${moved}, errors:${errors}`);

            return {
                success: errors === 0,
                message: `Provider organization completed: ${moved} files moved to ChatGPT folder, ${errors} errors`,
                details: { moved, errors }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] MoveToProviderFolder.execute failed:`, error);
            return {
                success: false,
                message: `Provider organization failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            // Check that no files remain in old structure
            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();

            const remainingOldFiles = allFiles.filter(file => {
                if (!file.path.startsWith(archiveFolder)) return false;

                const relativePath = file.path.substring(archiveFolder.length + 1);

                // Skip provider subfolders and special folders
                if (relativePath.startsWith('ChatGPT/') ||
                    relativePath.startsWith('Claude/') ||
                    relativePath.startsWith('chatgpt/') ||
                    relativePath.startsWith('claude/') ||
                    relativePath.startsWith('Reports/') ||
                    relativePath.startsWith('Attachments/') ||
                    relativePath.startsWith('reports/') ||
                    relativePath.startsWith('attachments/')) {
                    return false;
                }

                // Check if it's still in old structure
                const pathParts = relativePath.split('/');
                if (pathParts.length >= 3) {
                    const year = pathParts[0];
                    const month = pathParts[1];

                    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
                        return true;
                    }
                }

                return false;
            });

            if (remainingOldFiles.length > 0) {
                console.debug(`[NEXUS-DEBUG] MoveToProviderFolder.verify: Still ${remainingOldFiles.length} files in old structure`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`MoveToProviderFolder.verify failed:`, error);
            return false;
        }
    }
}

/**
 * Beautiful upgrade modal (like Excalidraw)
 */
export class NexusUpgradeModal extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;
    private resolve: (value: string) => void;

    constructor(app: App, plugin: NexusAiChatImporterPlugin, version: string, resolve: (value: string) => void) {
        super(app);
        this.plugin = plugin;
        this.version = version;
        this.resolve = resolve;
    }

    onOpen(): void {
        const { containerEl, contentEl, titleEl } = this;

        // Add Excalidraw-style CSS class
        containerEl.classList.add('nexus-upgrade-modal');

        // Set title like Excalidraw
        titleEl.setText(`🚀 Nexus AI Chat Importer ${this.version}`);

        this.createForm();
    }

    async onClose() {
        this.contentEl.empty();
    }

    async createForm() {
        const message = `🎉 **Upgrade to v1.2.0 successful!** Your conversations have been enhanced and reorganized.

**✅ What was migrated:**
• **Organization**: Conversations moved to ChatGPT subfolder for better structure
• **Modern callouts**: Beautiful user/assistant message design
• **Visual improvements**: Enhanced Reading View experience
• **Future-ready**: Prepared for multi-provider support

**⚠️ What was NOT migrated:**
• Missing attachment links and references
• Enhanced chronological ordering
• DALL-E prompt improvements
• Performance optimizations

**💡 To get ALL v1.2.0 features:** You need to reimport your original ChatGPT ZIP files. This will replace existing conversations with fully-featured versions.

---

## ☕ Support My Work

I spend about $100/month for A.I. services, not counting my time and other expenses. If this plugin makes your life easier, consider supporting its development:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

*Your support helps me continue building useful tools and explore new ways of making your life easier.*`;

        // Render markdown content
        await MarkdownRenderer.render(
            this.app,
            message,
            this.contentEl,
            "",
            this.plugin,
        );

        // Add single confirmation button
        this.contentEl.createEl("div", { cls: "nexus-upgrade-buttons" }, (el) => {
            el.style.textAlign = "right";
            el.style.marginTop = "20px";
            el.style.paddingTop = "15px";
            el.style.borderTop = "1px solid var(--background-modifier-border)";

            const btnOk = el.createEl("button", {
                text: "Got it, thanks!",
                cls: "nexus-btn-primary"
            });
            btnOk.onclick = () => {
                this.close();
                this.resolve("ok");
            };
        });
    }
}

/**
 * Offer full reimport for complete v1.2.0 features (manual operation)
 */
class OfferReimportOperation extends UpgradeOperation {
    readonly id = "offer-reimport";
    readonly name = "Full Feature Reimport";
    readonly description = "Optionally reimport conversations to get all v1.2.0 features (attachments, chronological order, etc.)";
    readonly type = "manual" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        // Always offer this option after callout conversion
        return true;
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            // The beautiful dialog is now shown BEFORE operations execute
            // This operation just provides information about the upgrade completion
            return {
                success: true,
                message: "Upgrade information provided to user",
                details: { action: "info_displayed" }
            };

        } catch (error) {
            console.error(`OfferReimport.execute failed:`, error);
            return {
                success: false,
                message: `Failed to complete reimport operation: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        // This operation always succeeds if it runs
        return true;
    }
}

/**
 * Version 1.2.0 Upgrade Definition
 */
export class Upgrade120 extends VersionUpgrade {
    readonly version = "1.2.0";

    readonly automaticOperations = [
        new MoveToProviderFolderOperation(),
        new ConvertToCalloutsOperation()
    ];

    readonly manualOperations = [
        new OfferReimportOperation()
    ];
}
