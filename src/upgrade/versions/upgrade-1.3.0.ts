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
 * Move Reports folder from inside Conversations folder to same level
 * Bug fix: Reports folder was incorrectly created inside archiveFolder (e.g., Nexus/Conversations/Reports)
 * Should be at same level as Conversations (e.g., Nexus/Reports)
 */
class MoveReportsFolderOperation extends UpgradeOperation {
    readonly id = "move-reports-folder";
    readonly name = "Move Reports Folder";
    readonly description = "Move Reports folder from inside Conversations to the same level";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;
            const oldReportsPath = `${archiveFolder}/Reports`;

            // Check if old Reports folder exists
            const oldReportsFolder = context.plugin.app.vault.getAbstractFileByPath(oldReportsPath);

            if (oldReportsFolder && oldReportsFolder instanceof TFolder) {
                // Check if it has any files
                const files = oldReportsFolder.children;
                return files.length > 0;
            }

            return false;
        } catch (error) {
            console.error(`MoveReportsFolder.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const results: string[] = [];
        let filesProcessed = 0;
        let filesFailed = 0;

        try {
            const archiveFolder = context.plugin.settings.archiveFolder;
            const oldReportsPath = `${archiveFolder}/Reports`;

            // Calculate new Reports path (same level as Conversations)
            const archiveFolderParts = archiveFolder.split('/');
            const parentFolder = archiveFolderParts.slice(0, -1).join('/');
            const newReportsPath = parentFolder ? `${parentFolder}/Reports` : 'Reports';

            context.logger.info(`Moving Reports folder from ${oldReportsPath} to ${newReportsPath}`);

            const oldReportsFolder = context.plugin.app.vault.getAbstractFileByPath(oldReportsPath);

            if (!oldReportsFolder || !(oldReportsFolder instanceof TFolder)) {
                return {
                    success: true,
                    message: "No Reports folder to move",
                    details: []
                };
            }

            // Ensure new Reports folder exists
            const { ensureFolderExists } = await import("../../utils");
            await ensureFolderExists(context.plugin.app, newReportsPath);

            // Get all files in old Reports folder (recursively)
            const filesToMove = this.getAllFilesRecursively(oldReportsFolder);

            context.logger.info(`Found ${filesToMove.length} files to move`);

            // Move each file
            for (const file of filesToMove) {
                try {
                    // Calculate relative path from old Reports folder
                    const relativePath = file.path.substring(oldReportsPath.length + 1);
                    const newPath = `${newReportsPath}/${relativePath}`;

                    // Ensure parent folder exists
                    const newParentPath = newPath.substring(0, newPath.lastIndexOf('/'));
                    await ensureFolderExists(context.plugin.app, newParentPath);

                    // Move file
                    await context.plugin.app.vault.rename(file, newPath);

                    filesProcessed++;
                    results.push(`Moved: ${file.path} → ${newPath}`);

                    context.updateProgress?.({
                        phase: 'processing',
                        title: 'Moving Reports folder...',
                        detail: `Moving file ${filesProcessed} of ${filesToMove.length}`,
                        current: filesProcessed,
                        total: filesToMove.length
                    });
                } catch (error) {
                    filesFailed++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    results.push(`Failed to move ${file.path}: ${errorMsg}`);
                    context.logger.error(`Failed to move ${file.path}:`, error);
                }
            }

            // Delete old Reports folder if empty
            try {
                const oldFolder = context.plugin.app.vault.getAbstractFileByPath(oldReportsPath);
                if (oldFolder && oldFolder instanceof TFolder && oldFolder.children.length === 0) {
                    await context.plugin.app.vault.delete(oldFolder);
                    results.push(`Deleted empty old Reports folder: ${oldReportsPath}`);
                }
            } catch (error) {
                context.logger.warn(`Could not delete old Reports folder:`, error);
            }

            return {
                success: filesFailed === 0,
                message: `Moved ${filesProcessed} files from ${oldReportsPath} to ${newReportsPath}`,
                details: results
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Failed to move Reports folder: ${errorMsg}`,
                details: results
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;
            const oldReportsPath = `${archiveFolder}/Reports`;

            // Verify old Reports folder is empty or doesn't exist
            const oldReportsFolder = context.plugin.app.vault.getAbstractFileByPath(oldReportsPath);

            if (oldReportsFolder && oldReportsFolder instanceof TFolder) {
                return oldReportsFolder.children.length === 0;
            }

            return true; // Folder doesn't exist = success
        } catch (error) {
            console.error(`MoveReportsFolder.verify failed:`, error);
            return false;
        }
    }

    private getAllFilesRecursively(folder: TFolder): any[] {
        const files: any[] = [];

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                files.push(...this.getAllFilesRecursively(child));
            } else {
                files.push(child);
            }
        }

        return files;
    }
}

/**
 * Version 1.3.0 Upgrade Definition
 */
export class Upgrade130 extends VersionUpgrade {
    readonly version = "1.3.0";

    readonly automaticOperations = [
        new MoveReportsFolderOperation(),
        new ConvertToISO8601TimestampsOperation(),
        new FixFrontmatterAliasesOperation()
    ];

    readonly manualOperations = [
        // No manual operations for this version
    ];
}
