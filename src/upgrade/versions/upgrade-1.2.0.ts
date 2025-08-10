// src/upgrade/versions/upgrade-1.2.0.ts
import { VersionUpgrade, UpgradeOperation, UpgradeContext, OperationResult } from "../upgrade-interface";
import { TFile } from "obsidian";
import { showDialog } from "../../dialogs";

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
            /<div class="nexus-artifact-box">/       // Old artifact divs
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
            const result = await showDialog({
                title: "Complete v1.2.0 Feature Upgrade",
                message: `Your conversations have been updated with modern callouts!

**Current Status:** Visual improvements applied ✅
**Optional:** Full reimport for complete v1.2.0 features

**Full reimport includes:**
• Missing attachment links with conversation URLs
• Perfect chronological message ordering
• Enhanced DALL-E prompt display
• Latest performance optimizations

**Note:** Full reimport will replace existing conversations with fresh imports from your original ZIP files.`,
                buttons: [
                    { text: "Keep Current (Recommended)", value: "keep" },
                    { text: "Learn About Reimport", value: "learn" },
                    { text: "Cancel", value: "cancel" }
                ]
            });

            if (result === "learn") {
                await showDialog({
                    title: "About Full Reimport",
                    message: `**Full Reimport Process:**

1. **Manual Process:** You'll need to reimport your ChatGPT ZIP files manually
2. **Overwrites:** Existing conversations will be replaced (backup recommended)
3. **Benefits:** All v1.2.0 features including missing attachments and perfect ordering
4. **When:** Do this when you have time and access to your original ZIP files

**Recommendation:** The visual callout upgrade is sufficient for most users. Consider full reimport only if you need the additional features.`,
                    buttons: [{ text: "Got it", value: "ok" }]
                });

                return {
                    success: true,
                    message: "Information provided about reimport options",
                    details: { action: "info_provided" }
                };
            }

            return {
                success: true,
                message: result === "keep" ? "Keeping current conversations with callout improvements" : "Operation cancelled",
                details: { action: result }
            };

        } catch (error) {
            console.error(`OfferReimport.execute failed:`, error);
            return {
                success: false,
                message: `Failed to show reimport dialog: ${error}`,
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
        new ConvertToCalloutsOperation()
    ];

    readonly manualOperations = [
        new OfferReimportOperation()
    ];
}
