/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


// src/upgrade/versions/upgrade-1.2.0.ts
import { VersionUpgrade, UpgradeOperation, UpgradeContext, OperationResult } from "../upgrade-interface";
import { App, Modal, MarkdownRenderer } from "obsidian";
import NexusAiChatImporterPlugin from "../../main";
import { logger } from "../../logger";

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
            const conversationFolder = context.plugin.settings.conversationFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();

            // Filter conversation files (exclude Reports/Attachments)
            const conversationFiles = allFiles.filter(file => {
                if (!file.path.startsWith(conversationFolder)) return false;

                const relativePath = file.path.substring(conversationFolder.length + 1);
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
                    logger.error(`Error checking file ${file.path}:`, error);
                }
            }

            return false;
        } catch (error) {
            logger.error(`ConvertToCallouts.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {

            const conversationFolder = context.plugin.settings.conversationFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();

            // Filter conversation files (exclude Reports/Attachments)
            const conversationFiles = allFiles.filter(file => {
                if (!file.path.startsWith(conversationFolder)) return false;

                const relativePath = file.path.substring(conversationFolder.length + 1);
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
                        logger.error(`Error converting ${file.path}:`, error);
                    }
                }

                // Small delay between batches to prevent blocking
                if (i + batchSize < conversationFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }


            return {
                success: errors === 0,
                message: `Callout conversion completed: ${converted} files converted, ${errors} errors`,
                details: { processed, converted, errors }
            };

        } catch (error) {
            logger.error(`ConvertToCallouts.execute failed:`, error);
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
            const conversationFolder = context.plugin.settings.conversationFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();

            // Check conversation files (sample verification)
            const conversationFiles = allFiles.filter(file => {
                if (!file.path.startsWith(conversationFolder)) return false;

                const relativePath = file.path.substring(conversationFolder.length + 1);
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
                        return false;
                    }

                    // Check if plugin_version was updated
                    if (!content.includes('plugin_version: "1.2.0"')) {
                        return false;
                    }

                } catch (error) {
                    logger.error(`Error verifying file ${file.path}:`, error);
                    return false;
                }
            }

            return true;
        } catch (error) {
            logger.error(`ConvertToCallouts.verify failed:`, error);
            return false;
        }
    }
}

/**
 * Move reports from root Reports/ folder to Reports/chatgpt/ (automatic operation)
 * For users upgrading directly from pre-1.1.0 versions
 */
class MoveReportsToProviderOperation extends UpgradeOperation {
    readonly id = "move-reports-to-provider";
    readonly name = "Organize Reports by Provider";
    readonly description = "Move reports from root Reports/ folder to Reports/chatgpt/";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const reportFolder = context.plugin.settings.reportFolder;

            // Check if there are any report files in the root Reports/ folder
            const reportFiles = context.plugin.app.vault
                .getMarkdownFiles()
                .filter(f => {
                    // Must be in root report folder (not in provider subfolder)
                    if (!f.path.startsWith(reportFolder + '/')) return false;

                    // Must not already be in a provider subfolder
                    const relativePath = f.path.substring(reportFolder.length + 1);
                    if (relativePath.includes('/')) return false; // Already in subfolder

                    // Must be an import report file
                    return f.name.includes('import report') || f.name.includes('import_');
                });

            return reportFiles.length > 0;
        } catch (error) {
            logger.error(`MoveReportsToProviderOperation.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            const reportFolder = context.plugin.settings.reportFolder;
            let processed = 0;
            let moved = 0;
            let errors = 0;

            // Find report files in root folder
            const reportFiles = context.plugin.app.vault
                .getMarkdownFiles()
                .filter(f => {
                    if (!f.path.startsWith(reportFolder + '/')) return false;
                    const relativePath = f.path.substring(reportFolder.length + 1);
                    if (relativePath.includes('/')) return false;
                    return f.name.includes('import report') || f.name.includes('import_');
                });

            // Ensure chatgpt subfolder exists
            const chatgptReportFolder = `${reportFolder}/chatgpt`;
            try {
                await context.plugin.app.vault.adapter.mkdir(chatgptReportFolder);
            } catch (e) {
                // Folder might already exist, that's fine
            }

            for (const file of reportFiles) {
                try {
                    processed++;
                    const newPath = `${chatgptReportFolder}/${file.name}`;

                    // Check if target already exists
                    if (await context.plugin.app.vault.adapter.exists(newPath)) {
                        continue;
                    }

                    await context.plugin.app.vault.adapter.rename(file.path, newPath);
                    moved++;
                } catch (error) {
                    errors++;
                    logger.error(`Error moving report ${file.path}:`, error);
                }
            }

            return {
                success: errors === 0,
                message: `Reports organized: ${moved} files moved to provider structure, ${errors} errors`,
                details: { processed, moved, errors }
            };
        } catch (error) {
            logger.error(`MoveReportsToProviderOperation.execute failed:`, error);
            return {
                success: false,
                message: `Report organization failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(_context: UpgradeContext): Promise<boolean> {
        // Simple operation; treat as successful if execute returned success
        return true;
    }
}

/**
 * Force update report links to include provider segment (automatic operation)
 * Only pattern considered: ${reportFolder}/chatgpt/
 */
class UpdateReportLinksOperation extends UpgradeOperation {
    readonly id = "update-report-links";
    readonly name = "Update Report Links";
    readonly description = "Insert 'chatgpt/' before year in report links inside reports";
    readonly type = "automatic" as const;

    async canRun(_context: UpgradeContext): Promise<boolean> {
        // Force run when this migration executes
        return true;
    }

    private escapeRegExp(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            const reportFolder = context.plugin.settings.reportFolder;
            const conversationFolder = context.plugin.settings.conversationFolder;
            const escapedArchive = this.escapeRegExp(conversationFolder);

            let processed = 0;
            let updated = 0;
            let errors = 0;

            // Consider both ${reportFolder}/chatgpt/ and ${reportFolder}/ (fallback for pre-1.1.0)
            const reportPrefixChatgpt = `${reportFolder}/chatgpt/`;
            const reportPrefixRoot = `${reportFolder}/`;

            const reportFiles = context.plugin.app.vault
                .getMarkdownFiles()
                .filter(f => {
                    // Include files in chatgpt subfolder
                    if (f.path.startsWith(reportPrefixChatgpt)) return true;

                    // Include files in root report folder (but not in other subfolders)
                    if (f.path.startsWith(reportPrefixRoot)) {
                        const relativePath = f.path.substring(reportPrefixRoot.length);
                        // Must be directly in root folder (no slashes = no subfolders)
                        if (!relativePath.includes('/') && (f.name.includes('import report') || f.name.includes('import_'))) {
                            return true;
                        }
                    }

                    return false;
                });

            // Regex: [[<conversationFolder>/YYYY/MM/ ...]] -> insert chatgpt/
            const linkPattern = new RegExp(`(\\[\\[${escapedArchive}/)(\\d{4}/\\d{2}/)`, 'g');

            for (const file of reportFiles) {
                try {
                    processed++;
                    const content = await context.plugin.app.vault.read(file);
                    const replaced = content.replace(linkPattern, '$1chatgpt/$2');
                    if (replaced !== content) {
                        await context.plugin.app.vault.modify(file, replaced);
                        updated++;
                    }
                } catch (e) {
                    errors++;
                    logger.error(`UpdateReportLinksOperation error in ${file.path}:`, e);
                }
            }

            return {
                success: errors === 0,
                message: `Report links updated: ${updated} files changed, ${errors} errors`,
                details: { processed, updated, errors }
            };
        } catch (error) {
            logger.error(`UpdateReportLinksOperation.execute failed:`, error);
            return {
                success: false,
                message: `Report link update failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(_context: UpgradeContext): Promise<boolean> {
        // Simple operation; treat as successful if execute returned success
        return true;
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
            const conversationFolder = context.plugin.settings.conversationFolder;

            // Check if year folders exist directly in conversation folder (not in chatgpt subfolder)
            const yearFolders = await this.findYearFolders(context, conversationFolder);

            return yearFolders.length > 0;
        } catch (error) {
            logger.error(`MoveYearFolders.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {

            const conversationFolder = context.plugin.settings.conversationFolder;

            let movedFolders = 0;
            let errors = 0;

            // Move <yyyy> folders to chatgpt/<yyyy>
            const yearFolders = await this.findYearFolders(context, conversationFolder);

            for (const yearFolder of yearFolders) {
                try {
                    const chatgptFolder = `${conversationFolder}/chatgpt`;
                    await context.plugin.app.vault.adapter.mkdir(chatgptFolder);

                    const newPath = `${chatgptFolder}/${yearFolder}`;
                    const oldPath = `${conversationFolder}/${yearFolder}`;

                    await context.plugin.app.vault.adapter.rename(oldPath, newPath);
                    movedFolders++;

                } catch (error) {
                    errors++;
                    logger.error(`Error moving year folder ${yearFolder}:`, error);
                }
            }


            return {
                success: errors === 0,
                message: `Conversation organization completed: ${movedFolders} year folders moved to chatgpt structure, ${errors} errors`,
                details: { movedFolders, errors }
            };

        } catch (error) {
            logger.error(`MoveYearFolders.execute failed:`, error);
            return {
                success: false,
                message: `Conversation organization failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            const conversationFolder = context.plugin.settings.conversationFolder;

            // Check that year folders are now in chatgpt structure
            const remainingYearFolders = await this.findYearFolders(context, conversationFolder);

            if (remainingYearFolders.length > 0) {
                return false;
            }

            return true;
        } catch (error) {
            logger.error(`MoveYearFolders.verify failed:`, error);
            return false;
        }
    }

    /**
     * Find year folders (YYYY) directly in conversation folder
     */
    private async findYearFolders(context: UpgradeContext, conversationFolder: string): Promise<string[]> {
        try {
            const folders = await context.plugin.app.vault.adapter.list(conversationFolder);
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
        const { containerEl, titleEl } = this;

        // Add Excalidraw-style CSS class
        containerEl.classList.add('nexus-upgrade-modal');

        // Set title like Excalidraw
        titleEl.setText(`🚀 Nexus AI Chat Importer ${this.version}`);
        this.modalEl.querySelector('.modal-close-button')?.remove();
        this.createForm();
    }

    async onClose() {
        this.contentEl.empty();
    }

    async createForm() {
        // Fetch release notes from GitHub
        let message = `🎉 **Upgrade to v1.2.0**

Your conversations will be reorganized with provider structure and modern callouts. All links in your reports will be updated. 

**💡 To get ALL v1.2.0 features:** Reimport your original ChatGPT ZIP files.

---

## ☕ Support My Work

[![Support my work](https://img.shields.io/badge/☕_Support_my_work-nexus--prod.dev-FF5E5B?style=for-the-badge)](https://nexus-prod.dev/nexus-ai-chat-importer/support)`;

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

    async canRun(_context: UpgradeContext): Promise<boolean> {
        // Always offer this option after callout conversion
        return true;
    }

    async execute(_context: UpgradeContext): Promise<OperationResult> {
        try {
            // The beautiful dialog is now shown BEFORE operations execute
            // This operation just provides information about the upgrade completion
            return {
                success: true,
                message: "Upgrade information provided to user",
                details: { action: "info_displayed" }
            };

        } catch (error) {
            logger.error(`OfferReimport.execute failed:`, error);
            return {
                success: false,
                message: `Failed to complete reimport operation: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(_context: UpgradeContext): Promise<boolean> {
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
        new MoveReportsToProviderOperation(),
        new UpdateReportLinksOperation(),
        new ConvertToCalloutsOperation()
    ];

    readonly manualOperations = [
        new OfferReimportOperation()
    ];
}
