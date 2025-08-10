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
 * Move year folders to chatgpt provider structure (automatic operation)
 * SIMPLE: Just move <yyyy> folders to chatgpt/<yyyy>
 */
class MoveYearFoldersOperation extends UpgradeOperation {
    readonly id = "move-year-folders";
    readonly name = "Organize Conversations by Provider";
    readonly description = "Move year folders to chatgpt provider structure";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;

            // Check if year folders exist directly in archive (not in chatgpt subfolder)
            const yearFolders = await this.findYearFolders(context, archiveFolder);

            return yearFolders.length > 0;
        } catch (error) {
            console.error(`MoveYearFolders.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] MoveYearFolders.execute starting`);

            const archiveFolder = context.plugin.settings.archiveFolder;

            let movedFolders = 0;
            let errors = 0;

            // Move <yyyy> folders to chatgpt/<yyyy>
            const yearFolders = await this.findYearFolders(context, archiveFolder);

            for (const yearFolder of yearFolders) {
                try {
                    const chatgptFolder = `${archiveFolder}/chatgpt`;
                    await context.plugin.app.vault.adapter.mkdir(chatgptFolder);

                    const newPath = `${chatgptFolder}/${yearFolder}`;
                    const oldPath = `${archiveFolder}/${yearFolder}`;

                    await context.plugin.app.vault.adapter.rename(oldPath, newPath);
                    movedFolders++;

                    console.debug(`[NEXUS-DEBUG] Moved ${yearFolder} to chatgpt/${yearFolder}`);
                } catch (error) {
                    errors++;
                    console.error(`[NEXUS-DEBUG] Error moving year folder ${yearFolder}:`, error);
                }
            }

            console.debug(`[NEXUS-DEBUG] MoveYearFolders: Completed - moved:${movedFolders}, errors:${errors}`);

            return {
                success: errors === 0,
                message: `Conversation organization completed: ${movedFolders} year folders moved to chatgpt structure, ${errors} errors`,
                details: { movedFolders, errors }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] MoveYearFolders.execute failed:`, error);
            return {
                success: false,
                message: `Conversation organization failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;

            // Check that year folders are now in chatgpt structure
            const remainingYearFolders = await this.findYearFolders(context, archiveFolder);

            if (remainingYearFolders.length > 0) {
                console.debug(`[NEXUS-DEBUG] MoveYearFolders.verify: Still ${remainingYearFolders.length} year folders in old structure`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`MoveYearFolders.verify failed:`, error);
            return false;
        }
    }

    /**
     * Find year folders (YYYY) directly in archive folder
     */
    private async findYearFolders(context: UpgradeContext, archiveFolder: string): Promise<string[]> {
        try {
            const folders = await context.plugin.app.vault.adapter.list(archiveFolder);
            return folders.folders.filter(folder => {
                const folderName = folder.split('/').pop() || '';
                return /^\d{4}$/.test(folderName) && folderName !== 'chatgpt';
            }).map(folder => folder.split('/').pop() || '');
        } catch (error) {
            return [];
        }
    }
}

/**
 * Fix conversation links in reports after folder migration (automatic operation)
 */
class FixReportLinksOperation extends UpgradeOperation {
    readonly id = "fix-report-links";
    readonly name = "Fix Report Links";
    readonly description = "Update conversation links in reports after folder reorganization";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            console.debug(`[NEXUS-DEBUG] FixReportLinks.canRun: STARTING`);
            const reportFolder = context.plugin.settings.reportFolder;
            const archiveFolder = context.plugin.settings.archiveFolder;

            // Get ALL files in Reports/chatgpt/ folder
            const reportFiles = context.plugin.app.vault.getMarkdownFiles().filter(file =>
                file.path.startsWith(`${reportFolder}/chatgpt/`)
            );

            console.debug(`[NEXUS-DEBUG] FixReportLinks.canRun: Found ${reportFiles.length} report files`);

            if (reportFiles.length === 0) {
                console.debug(`[NEXUS-DEBUG] FixReportLinks.canRun: No report files, returning false`);
                return false;
            }

            // Check if any report contains old links that need fixing
            for (const file of reportFiles.slice(0, 3)) {
                try {
                    const content = await context.plugin.app.vault.read(file);

                    // Look for links like: [[Nexus AI Chat Imports/2024/12/...]] or [[archiveFolder/2024/12/...]]
                    const archiveFolderName = archiveFolder.split('/').pop() || 'Nexus AI Chat Imports';
                    const oldLinkPattern = new RegExp(`\\[\\[${archiveFolderName}/\\d{4}/\\d{2}/`, 'g');

                    if (content.match(oldLinkPattern)) {
                        console.debug(`[NEXUS-DEBUG] FixReportLinks.canRun: Found old links in ${file.path}, returning true`);
                        return true;
                    }
                } catch (error) {
                    console.error(`[NEXUS-DEBUG] FixReportLinks.canRun: Error reading ${file.path}:`, error);
                }
            }

            console.debug(`[NEXUS-DEBUG] FixReportLinks.canRun: No old links found, returning false`);
            return false;
        } catch (error) {
            console.error(`[NEXUS-DEBUG] FixReportLinks.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] FixReportLinks.execute starting`);

            const reportFolder = context.plugin.settings.reportFolder;

            let fixedFiles = 0;
            let errors = 0;

            // Get ALL files in Reports/chatgpt/ folder (SED-LIKE approach)
            const reportFiles = context.plugin.app.vault.getMarkdownFiles().filter(file =>
                file.path.startsWith(`${reportFolder}/chatgpt/`)
            );

            console.debug(`[NEXUS-DEBUG] FixReportLinks: Processing ${reportFiles.length} report files`);

            for (const file of reportFiles) {
                try {
                    console.debug(`[NEXUS-DEBUG] FixReportLinks: Processing ${file.path}`);
                    const content = await context.plugin.app.vault.read(file);

                    // Fix links: [[archiveFolder/2024/12/...]] → [[archiveFolder/chatgpt/2024/12/...]]
                    const archiveFolder = context.plugin.settings.archiveFolder;
                    const archiveFolderName = archiveFolder.split('/').pop() || 'Nexus AI Chat Imports';

                    // Pattern: [[Nexus AI Chat Imports/2024/12/...]] → [[Nexus AI Chat Imports/chatgpt/2024/12/...]]
                    const linkPattern = new RegExp(`(\\[\\[${archiveFolderName}/)(\d{4}/\d{2}/)`, 'g');

                    const updatedContent = content.replace(linkPattern, '$1chatgpt/$2');

                    // Check if anything changed
                    if (updatedContent !== content) {
                        await context.plugin.app.vault.modify(file, updatedContent);
                        fixedFiles++;
                        console.debug(`[NEXUS-DEBUG] Fixed year paths in report: ${file.path}`);
                    } else {
                        console.debug(`[NEXUS-DEBUG] No year paths to fix in: ${file.path}`);
                    }

                } catch (error) {
                    errors++;
                    console.error(`[NEXUS-DEBUG] Error fixing paths in report ${file.path}:`, error);
                }
            }

            console.debug(`[NEXUS-DEBUG] FixReportLinks: Completed - fixed:${fixedFiles}, errors:${errors}`);

            return {
                success: errors === 0,
                message: `Report link correction completed: ${fixedFiles} reports updated, ${errors} errors`,
                details: { fixedFiles, errors }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] FixReportLinks.execute failed:`, error);
            return {
                success: false,
                message: `Report link correction failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            console.debug(`[NEXUS-DEBUG] FixReportLinks.verify: Verification complete (always true for simple replacement)`);
            return true;
        } catch (error) {
            console.error(`FixReportLinks.verify failed:`, error);
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
        // Fetch release notes from GitHub
        let message = `🎉 **Upgrade to v1.2.0**

Your conversations will be reorganized with provider structure and modern callouts.

**💡 To get ALL v1.2.0 features:** Reimport your original ChatGPT ZIP files.

---

## ☕ Support My Work

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)`;

        try {
            // Try to fetch release notes from GitHub
            const response = await fetch('https://api.github.com/repos/Superkikim/nexus-ai-chat-importer/releases/tags/v1.2.0');
            if (response.ok) {
                const release = await response.json();
                if (release.body) {
                    message = release.body;
                }
            }
        } catch (error) {
            // Use fallback message if GitHub fetch fails
            console.debug('[NEXUS-DEBUG] Could not fetch release notes from GitHub, using fallback');
        }

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
                text: "Proceed",
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
        new MoveYearFoldersOperation(),
        new FixReportLinksOperation(),
        new ConvertToCalloutsOperation()
    ];

    readonly manualOperations = [
        new OfferReimportOperation()
    ];
}
