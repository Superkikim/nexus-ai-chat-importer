// src/upgrade/versions/upgrade-1.3.0.ts
import { VersionUpgrade, UpgradeOperation, UpgradeContext, OperationResult } from "../upgrade-interface";
import type NexusAiChatImporterPlugin from "../../main";
import { generateSafeAlias } from "../../utils";
import { TFolder } from "obsidian";

/**
 * Convert timestamps to ISO 8601 format in all existing frontmatter
 * This resolves locale-dependent parsing issues and provides a universal timestamp format.
 * Migration converts US format (MM/DD/YYYY at H:MM:SS AM/PM) to ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
 */
class ConvertToISO8601TimestampsOperation extends UpgradeOperation {
    readonly id = "convert-to-iso8601-timestamps";
    readonly name = "Convert Timestamps to ISO 8601";
    readonly description = "Convert all create_time and update_time frontmatter entries from US format to ISO 8601 format";
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

            // Check if any files have US format timestamps (need conversion to ISO 8601)
            for (const file of conversationFiles.slice(0, 10)) { // Sample first 10 files
                try {
                    const content = await context.plugin.app.vault.read(file);

                    // Only check files that belong to this plugin
                    if (!this.isNexusFile(content)) {
                        continue;
                    }

                    // Check for US format timestamps
                    if (this.hasUSFormatTimestamps(content)) {
                        return true;
                    }
                } catch (error) {
                    console.error(`Error checking file ${file.path}:`, error);
                }
            }

            return false;
        } catch (error) {
            console.error(`ConvertToISO8601Timestamps.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps.execute starting`);

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
            let skipped = 0;
            let errors = 0;

            console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps: Processing ${conversationFiles.length} files`);

            // Process files in smaller batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < conversationFiles.length; i += batchSize) {
                const batch = conversationFiles.slice(i, i + batchSize);

                // Update progress if callback provided
                if (context.progressCallback) {
                    const percentage = Math.round((i / conversationFiles.length) * 100);
                    context.progressCallback({
                        status: 'running',
                        progress: percentage,
                        currentDetail: `Converting timestamps: ${i}/${conversationFiles.length} files`
                    });
                }

                for (const file of batch) {
                    processed++;

                    try {
                        const content = await context.plugin.app.vault.read(file);

                        // Only process Nexus plugin files
                        if (!this.isNexusFile(content)) {
                            skipped++;
                            continue;
                        }

                        // Only process files with US format timestamps
                        if (!this.hasUSFormatTimestamps(content)) {
                            continue;
                        }

                        const convertedContent = this.convertTimestampsToISO8601(content);

                        if (content !== convertedContent) {
                            // Update plugin_version to 1.3.0
                            const finalContent = this.updatePluginVersion(convertedContent, "1.3.0");
                            await context.plugin.app.vault.modify(file, finalContent);
                            converted++;
                        }

                    } catch (error) {
                        errors++;
                        console.error(`[NEXUS-DEBUG] Error converting timestamps in ${file.path}:`, error);
                    }
                }

                // Small delay between batches to prevent blocking
                if (i + batchSize < conversationFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            // Final progress update
            if (context.progressCallback) {
                context.progressCallback({
                    status: 'running',
                    progress: 100,
                    currentDetail: `Completed: ${converted} timestamps converted`
                });
            }

            console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps: Completed - processed:${processed}, converted:${converted}, skipped:${skipped}, errors:${errors}`);

            return {
                success: errors === 0,
                message: `Timestamp conversion completed: ${converted} files updated, ${skipped} skipped (non-Nexus), ${errors} errors`,
                details: { processed, converted, skipped, errors }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] ConvertToISO8601Timestamps.execute failed:`, error);
            return {
                success: false,
                message: `Timestamp conversion failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    /**
     * Check if file belongs to Nexus plugin
     */
    private isNexusFile(content: string): boolean {
        return content.includes('nexus: nexus-ai-chat-importer');
    }

    /**
     * Check if content has US format timestamps (need conversion to ISO 8601)
     * Pattern: create_time: MM/DD/YYYY at H:MM:SS AM/PM
     */
    private hasUSFormatTimestamps(content: string): boolean {
        // Extract frontmatter only
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) return false;

        const frontmatter = frontmatterMatch[1];

        // Check for US format timestamps in frontmatter
        // Pattern: MM/DD/YYYY at H:MM:SS AM/PM or MM/DD/YYYY at H:MM AM/PM
        return /^(create|update)_time: \d{1,2}\/\d{1,2}\/\d{4} at \d{1,2}:\d{2}(:\d{2})? (AM|PM)$/m.test(frontmatter);
    }

    /**
     * Convert US format timestamps to ISO 8601 in frontmatter only
     * Converts: MM/DD/YYYY at H:MM:SS AM/PM → YYYY-MM-DDTHH:MM:SSZ
     */
    private convertTimestampsToISO8601(content: string): string {
        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) return content;

        let frontmatter = frontmatterMatch[1];
        const restOfContent = content.substring(frontmatterMatch[0].length);

        // Convert timestamps in frontmatter only
        // Pattern: create_time: 10/04/2025 at 10:30:45 PM
        frontmatter = frontmatter.replace(
            /^(create|update)_time: (\d{1,2})\/(\d{1,2})\/(\d{4}) at (\d{1,2}):(\d{2})(?::(\d{2}))? (AM|PM)$/gm,
            (match, field, month, day, year, hour, minute, second, ampm) => {
                // Convert to 24-hour format
                let h = parseInt(hour);
                if (ampm === 'PM' && h !== 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;

                // Default seconds to 00 if not present
                const sec = second || '00';

                // Build ISO 8601 string
                const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${h.toString().padStart(2, '0')}:${minute}:${sec}Z`;

                return `${field}_time: ${isoDate}`;
            }
        );

        // Reconstruct file
        return `---\n${frontmatter}\n---${restOfContent}`;
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

                    // Skip non-Nexus files
                    if (!this.isNexusFile(content)) {
                        continue;
                    }

                    // Check if still has US format timestamps
                    if (this.hasUSFormatTimestamps(content)) {
                        console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps.verify: Still has US format timestamps in ${file.path}`);
                        return false;
                    }

                    // Check if plugin_version was updated
                    if (!content.includes('plugin_version: "1.3.0"')) {
                        console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps.verify: Missing v1.3.0 in ${file.path}`);
                        return false;
                    }

                } catch (error) {
                    console.error(`Error verifying file ${file.path}:`, error);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(`ConvertToISO8601Timestamps.verify failed:`, error);
            return false;
        }
    }
}

/**
 * Fix frontmatter aliases with YAML special characters
 * This resolves Issue #17 - titles with colons, brackets, braces, etc.
 */
class FixFrontmatterAliasesOperation extends UpgradeOperation {
    readonly id = "fix-frontmatter-aliases";
    readonly name = "Fix Frontmatter Aliases";
    readonly description = "Fix aliases containing YAML special characters (colons, brackets, braces, etc.)";
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

            // Check if any files have problematic aliases
            for (const file of conversationFiles.slice(0, 10)) { // Sample first 10 files
                try {
                    const content = await context.plugin.app.vault.read(file);

                    // Only check files that belong to this plugin
                    if (!this.isNexusFile(content)) {
                        continue;
                    }

                    // Check for problematic aliases
                    if (this.hasProblematicAlias(content)) {
                        return true;
                    }
                } catch (error) {
                    console.error(`Error checking file ${file.path}:`, error);
                }
            }

            return false;
        } catch (error) {
            console.error(`FixFrontmatterAliases.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] FixFrontmatterAliases.execute starting`);

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
            let fixed = 0;
            let skipped = 0;
            let errors = 0;

            console.debug(`[NEXUS-DEBUG] FixFrontmatterAliases: Processing ${conversationFiles.length} files`);

            // Process files in smaller batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < conversationFiles.length; i += batchSize) {
                const batch = conversationFiles.slice(i, i + batchSize);

                // Update progress if callback provided
                if (context.progressCallback) {
                    const percentage = Math.round((i / conversationFiles.length) * 100);
                    context.progressCallback({
                        status: 'running',
                        progress: percentage,
                        currentDetail: `Checking aliases: ${i}/${conversationFiles.length} files`
                    });
                }

                for (const file of batch) {
                    processed++;

                    try {
                        const content = await context.plugin.app.vault.read(file);

                        // Only process Nexus plugin files
                        if (!this.isNexusFile(content)) {
                            skipped++;
                            continue;
                        }

                        // Only process files with problematic aliases
                        if (!this.hasProblematicAlias(content)) {
                            continue;
                        }

                        const fixedContent = this.fixAliases(content);

                        if (content !== fixedContent) {
                            await context.plugin.app.vault.modify(file, fixedContent);
                            fixed++;
                        }

                    } catch (error) {
                        errors++;
                        console.error(`[NEXUS-DEBUG] Error fixing aliases in ${file.path}:`, error);
                    }
                }

                // Small delay between batches to prevent blocking
                if (i + batchSize < conversationFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            // Final progress update
            if (context.progressCallback) {
                context.progressCallback({
                    status: 'running',
                    progress: 100,
                    currentDetail: `Completed: ${fixed} aliases fixed`
                });
            }

            console.debug(`[NEXUS-DEBUG] FixFrontmatterAliases: Completed - processed:${processed}, fixed:${fixed}, skipped:${skipped}, errors:${errors}`);

            return {
                success: errors === 0,
                message: `Alias fix completed: ${fixed} files updated, ${skipped} skipped (non-Nexus), ${errors} errors`,
                details: { processed, fixed, skipped, errors }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] FixFrontmatterAliases.execute failed:`, error);
            return {
                success: false,
                message: `Alias fix failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    /**
     * Check if file belongs to Nexus plugin
     */
    private isNexusFile(content: string): boolean {
        return content.includes('nexus: nexus-ai-chat-importer');
    }

    /**
     * Check if content has problematic aliases (YAML special characters without proper quoting)
     */
    private hasProblematicAlias(content: string): boolean {
        // Extract frontmatter only
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) return false;

        const frontmatter = frontmatterMatch[1];

        // Check for aliases line
        const aliasMatch = frontmatter.match(/^aliases: (.+)$/m);
        if (!aliasMatch) return false;

        const aliasValue = aliasMatch[1];

        // Check if alias contains YAML special characters but is not properly quoted
        // Problematic patterns:
        // - Contains colon but not quoted: "aliases: My Title: Subtitle"
        // - Contains brackets/braces but not quoted: "aliases: My [Title]"
        // - Starts with special char but not quoted: "aliases: #hashtag"

        // If already properly quoted with single quotes, it's fine
        if (aliasValue.startsWith("'") && aliasValue.endsWith("'")) {
            return false;
        }

        // If already properly quoted with double quotes (old format), needs fixing
        if (aliasValue.startsWith('"') && aliasValue.endsWith('"')) {
            return true;
        }

        // Check for YAML special characters that need quoting
        const needsQuoting =
            aliasValue.includes(':') ||
            aliasValue.includes('[') ||
            aliasValue.includes(']') ||
            aliasValue.includes('{') ||
            aliasValue.includes('}') ||
            aliasValue.includes('"') ||
            /^(true|false|null|yes|no|on|off|\d+|\d*\.\d+)$/i.test(aliasValue) ||
            aliasValue.startsWith('#') ||
            aliasValue.startsWith('&') ||
            aliasValue.startsWith('*') ||
            aliasValue.startsWith('!') ||
            aliasValue.startsWith('|') ||
            aliasValue.startsWith('>') ||
            aliasValue.startsWith('%') ||
            aliasValue.startsWith('@') ||
            aliasValue.startsWith('`');

        return needsQuoting;
    }

    /**
     * Fix aliases in frontmatter using generateSafeAlias
     */
    private fixAliases(content: string): string {
        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) return content;

        let frontmatter = frontmatterMatch[1];
        const restOfContent = content.substring(frontmatterMatch[0].length);

        // Find and fix aliases line
        frontmatter = frontmatter.replace(
            /^aliases: (.+)$/m,
            (match, aliasValue) => {
                // Remove existing quotes if any
                let cleanAlias = aliasValue.trim();
                if ((cleanAlias.startsWith('"') && cleanAlias.endsWith('"')) ||
                    (cleanAlias.startsWith("'") && cleanAlias.endsWith("'"))) {
                    cleanAlias = cleanAlias.slice(1, -1);
                }

                // Unescape any escaped quotes
                cleanAlias = cleanAlias.replace(/''/g, "'");

                // Generate safe alias
                const safeAlias = generateSafeAlias(cleanAlias);

                return `aliases: ${safeAlias}`;
            }
        );

        // Reconstruct file
        return `---\n${frontmatter}\n---${restOfContent}`;
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

                    // Skip non-Nexus files
                    if (!this.isNexusFile(content)) {
                        continue;
                    }

                    // Check if still has problematic aliases
                    if (this.hasProblematicAlias(content)) {
                        console.debug(`[NEXUS-DEBUG] FixFrontmatterAliases.verify: Still has problematic alias in ${file.path}`);
                        return false;
                    }

                } catch (error) {
                    console.error(`Error verifying file ${file.path}:`, error);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(`FixFrontmatterAliases.verify failed:`, error);
            return false;
        }
    }
}

/**
 * Migrate to new folder settings structure
 * - Rename archiveFolder → conversationFolder
 * - Create reportFolder setting
 * - Remove deprecated settings
 * - No file movement (user can do it manually via settings UI)
 */
class MigrateToSeparateFoldersOperation extends UpgradeOperation {
    readonly id = "migrate-to-separate-folders";
    readonly name = "Update Folder Settings";
    readonly description = "Separate Reports and Attachments from Conversations folder";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        // Run if old archiveFolder setting exists
        return !!context.plugin.settings.archiveFolder;
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const results: string[] = [];

        try {
            const oldArchiveFolder = context.plugin.settings.archiveFolder || "Nexus/Conversations";

            context.logger.debug(`[MigrateToSeparateFolders] Old archiveFolder: ${oldArchiveFolder}`);

            // Migrate settings
            context.plugin.settings.conversationFolder = oldArchiveFolder;
            context.plugin.settings.reportFolder = `${oldArchiveFolder}/Reports`;

            // Migrate attachmentFolder (keep existing or set default)
            if (!context.plugin.settings.attachmentFolder) {
                context.plugin.settings.attachmentFolder = "Nexus/Attachments";
            }

            // Migrate conversationPageSize to lastConversationsPerPage
            if (context.plugin.settings.conversationPageSize) {
                context.plugin.settings.lastConversationsPerPage = context.plugin.settings.conversationPageSize;
            } else {
                context.plugin.settings.lastConversationsPerPage = 50;
            }

            // Remove deprecated settings
            delete context.plugin.settings.archiveFolder;
            delete context.plugin.settings.importAttachments;
            delete context.plugin.settings.skipMissingAttachments;
            delete context.plugin.settings.showAttachmentDetails;
            delete context.plugin.settings.defaultImportMode;
            delete context.plugin.settings.rememberLastImportMode;
            delete context.plugin.settings.conversationPageSize;
            delete context.plugin.settings.autoSelectAllOnOpen;

            await context.plugin.saveSettings();

            results.push(`✅ Conversation folder: ${context.plugin.settings.conversationFolder}`);
            results.push(`✅ Report folder: ${context.plugin.settings.reportFolder}`);
            results.push(`✅ Attachment folder: ${context.plugin.settings.attachmentFolder}`);
            results.push(`ℹ️  Note: Existing files were NOT moved. You can move them manually in settings if needed.`);

            context.logger.debug(`[MigrateToSeparateFolders] Migration completed successfully`);

            return {
                success: true,
                message: "Folder settings updated successfully",
                details: results
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            context.logger.error(`[MigrateToSeparateFolders] Failed:`, error);
            results.push(`Error: ${errorMsg}`);
            return {
                success: false,
                message: `Failed to update folder settings: ${errorMsg}`,
                details: results
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            // Verify new settings exist
            return !!(
                context.plugin.settings.conversationFolder &&
                context.plugin.settings.reportFolder &&
                context.plugin.settings.attachmentFolder &&
                !context.plugin.settings.archiveFolder  // Old setting should be gone
            );
        } catch (error) {
            console.error(`MigrateToSeparateFolders.verify failed:`, error);
            return false;
        }
    }
}

/**
 * Version 1.3.0 Upgrade Definition
 */
export class Upgrade130 extends VersionUpgrade {
    readonly version = "1.3.0";

    readonly automaticOperations = [
        new MigrateToSeparateFoldersOperation(),
        new ConvertToISO8601TimestampsOperation(),
        new FixFrontmatterAliasesOperation()
    ];

    readonly manualOperations = [
        // No manual operations for this version
    ];
}
