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


// src/upgrade/versions/upgrade-1.3.0.ts
import { VersionUpgrade, UpgradeOperation, UpgradeContext, OperationResult } from "../upgrade-interface";
import type NexusAiChatImporterPlugin from "../../main";
import { generateSafeAlias } from "../../utils";
import { DateParser } from "../../utils/date-parser";
import { TFolder } from "obsidian";
import { ConfigureFolderLocationsDialog, FolderConfigurationResult } from "../../dialogs/configure-folder-locations-dialog";

/**
 * Convert timestamps to ISO 8601 format in all existing frontmatter
 * This resolves locale-dependent parsing issues and provides a universal timestamp format.
 * Migration converts US format (MM/DD/YYYY at H:MM:SS AM/PM) to ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
 */
class ConvertToISO8601TimestampsOperation extends UpgradeOperation {
    readonly id = "convert-to-iso8601-timestamps";
    readonly name = "Convert Timestamps to ISO 8601";
    readonly description = "Converts conversation timestamps to universal ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ). This fixes parsing issues with locale-specific date formats and ensures consistent timestamps across all regions.";
    readonly type = "automatic" as const;

    private globalOrder?: 'YMD' | 'DMY' | 'MDY';


    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const conversationFolder = context.plugin.settings.conversationFolder || context.plugin.settings.archiveFolder || "Nexus/Conversations";
            console.debug(`[NEXUS-UPGRADE] ConvertToISO8601Timestamps.canRun - conversationFolder: ${conversationFolder}`);

            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            console.debug(`[NEXUS-UPGRADE] ConvertToISO8601Timestamps.canRun - total markdown files: ${allFiles.length}`);

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

            console.debug(`[NEXUS-UPGRADE] ConvertToISO8601Timestamps.canRun - conversation files: ${conversationFiles.length}`);

            // Build a fast sample via metadataCache (no file I/O)
            const samples: string[] = [];
            let foundNonISO = false;

            for (const file of conversationFiles) {
                const fm = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter as any;
                if (!fm || fm.nexus !== context.plugin.manifest.id) continue;

                const vals = [fm.create_time, fm.update_time].filter(v => typeof v === 'string') as string[];
                for (const v of vals) {
                    if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d{3})?Z?$/.test(v)) {
                        samples.push(v);
                        foundNonISO = true;
                    }
                }
            }

            // Determine a global order hint from decisive samples
            if (samples.length) {
                const format = DateParser.detectFormatFromSamples(samples);
                this.globalOrder = format?.order;
                console.debug(`[NEXUS-UPGRADE] ConvertToISO8601Timestamps.canRun - detected global order: ${this.globalOrder ?? 'none'}`);
            }

            if (foundNonISO) {
                console.debug(`[NEXUS-UPGRADE] ConvertToISO8601Timestamps.canRun - FOUND non-ISO timestamps`);
                return true;
            }

            console.debug(`[NEXUS-UPGRADE] ConvertToISO8601Timestamps.canRun - NO non-ISO timestamps found`);
            return false;
        } catch (error) {
            console.error(`[NEXUS-UPGRADE] ConvertToISO8601Timestamps.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps.execute starting`);

            const conversationFolder = context.plugin.settings.conversationFolder || context.plugin.settings.archiveFolder || "Nexus/Conversations";
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

            // Determine global order hint if not already computed
            if (!this.globalOrder) {
                const samples: string[] = [];
                for (const file of conversationFiles) {
                    const fm = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter as any;
                    if (!fm || fm.nexus !== context.plugin.manifest.id) continue;
                    const vals = [fm.create_time, fm.update_time].filter(v => typeof v === 'string') as string[];
                    for (const v of vals) {
                        if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d{3})?Z?$/.test(v)) {
                            samples.push(v);
                        }
                    }
                }
                if (samples.length) {
                    const format = DateParser.detectFormatFromSamples(samples);
                    this.globalOrder = format?.order;
                    console.debug(`[NEXUS-UPGRADE] execute - detected global order: ${this.globalOrder ?? 'none'}`);
                }
            }

            let processed = 0;
            let converted = 0;
            let skipped = 0;
            let alreadyISO = 0;
            let failed = 0;
            let errors = 0;

            console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps: Processing ${conversationFiles.length} files`);

            // Process files in smaller batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < conversationFiles.length; i += batchSize) {
                const batch = conversationFiles.slice(i, i + batchSize);


                for (const file of batch) {
                    processed++;

                    try {
                        const content = await context.plugin.app.vault.read(file);

                        // Only process Nexus plugin files
                        if (!this.isNexusFile(content)) {
                            skipped++;
                            continue;
                        }

                        const hadNonISO = this.hasNonISOTimestamps(content);
                        if (!hadNonISO) {
                            alreadyISO++;
                            continue; // Nothing to do
                        }

                        const convertedContent = this.convertTimestampsToISO8601(content);

                        if (content !== convertedContent) {
                            // Update plugin_version to 1.3.0
                            const finalContent = this.updatePluginVersion(convertedContent, "1.3.0");
                            await context.plugin.app.vault.modify(file, finalContent);
                            converted++;
                        } else {
                            // Still has non-ISO after attempt → mark as failed
                            failed++;
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

            console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps: Completed - processed:${processed}, converted:${converted}, skipped:${skipped}, errors:${errors}`);

            const results: string[] = [];
            results.push(`**What this does:**`);
            results.push(`Converts conversation timestamps to universal ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ).`);
            results.push(`This fixes parsing issues with locale-specific date formats.`);
            results.push(``);
            results.push(`**Summary:**`);
            results.push(``);
            results.push(`- Total files scanned: ${processed}`);
            results.push(`- Already in ISO format: ${alreadyISO}`);
            results.push(`- Converted to ISO: ${converted}`);
            results.push(`- Skipped (non-Nexus): ${skipped}`);
            if (failed > 0) {
                results.push(`- Failed to convert: ${failed}`);
            }
            if (errors > 0) {
                results.push(`- Errors: ${errors}`);
            }

            return {
                success: errors === 0,
                message: `Converted ${converted} conversation(s) to ISO 8601 format.`,
                details: results
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
     * Check if content has non-ISO timestamps (need conversion to ISO 8601)
     * Detects any format that is not already ISO 8601
     */
    private hasNonISOTimestamps(content: string): boolean {
        // Extract frontmatter only
        const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!frontmatterMatch) {
            console.debug(`[NEXUS-UPGRADE] hasNonISOTimestamps - no frontmatter found`);
            return false;
        }

        const frontmatter = frontmatterMatch[1];

        // Check for ISO 8601 format (if present, no conversion needed)
        const hasISO = /^(create|update)_time: \d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/m.test(frontmatter);
        console.debug(`[NEXUS-UPGRADE] hasNonISOTimestamps - hasISO: ${hasISO}`);

        if (hasISO) {
            return false; // Already ISO, no conversion needed
        }

        // Check for any date-like pattern (needs conversion)
        // Matches: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, DD.MM.YYYY, etc.
        const hasNonISO = /^(create|update)_time: \d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}/m.test(frontmatter);
        console.debug(`[NEXUS-UPGRADE] hasNonISOTimestamps - hasNonISO pattern match: ${hasNonISO}`);

        return hasNonISO;
    }

    /**
     * Convert any date format to ISO 8601 in frontmatter only
     * Supports: US, EU, DE, JP, and all locale-based formats
     * Uses intelligent DateParser for automatic format detection
     */
    private convertTimestampsToISO8601(content: string): string {
        console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - START`);

        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!frontmatterMatch) {
            console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - no frontmatter found`);
            return content;
        }

        let frontmatter = frontmatterMatch[1];
        const restOfContent = content.substring(frontmatterMatch[0].length);

        console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - original frontmatter:\n${frontmatter}`);

        // Convert timestamps in frontmatter using intelligent parser
        // Matches any date format: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, DD.MM.YYYY, etc.
        let conversionCount = 0;
        frontmatter = frontmatter.replace(
            /^(create|update)_time: (.+)$/gm,
            (match, field, dateStr) => {
                console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - processing ${field}_time: "${dateStr}"`);

                // Skip if already ISO 8601
                if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(dateStr)) {
                    console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - already ISO, skipping`);
                    return match; // Already ISO, keep as-is
                }

                // Convert using intelligent parser
                console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - calling DateParser.convertToISO8601("${dateStr}")`);
                let isoDate = DateParser.convertToISO8601(dateStr);

                // Fallback: if global order was detected, try with forced order
                if (!isoDate && this.globalOrder) {
                    console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - trying fallback with order ${this.globalOrder}`);
                    isoDate = DateParser.convertToISO8601WithOrder(dateStr, this.globalOrder);
                }

                if (!isoDate) {
                    console.warn(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - FAILED to convert: ${dateStr}`);
                    return match; // Keep original if conversion fails
                }

                console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - SUCCESS: "${dateStr}" → "${isoDate}"`);
                conversionCount++;
                return `${field}_time: ${isoDate}`;
            }
        );

        console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - converted ${conversionCount} timestamps`);
        console.debug(`[NEXUS-UPGRADE] convertTimestampsToISO8601 - new frontmatter:\n${frontmatter}`);

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
            const conversationFolder = context.plugin.settings.conversationFolder || context.plugin.settings.archiveFolder || "Nexus/Conversations";
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

                    // Skip non-Nexus files
                    if (!this.isNexusFile(content)) {
                        continue;
                    }

                    // Check if still has non-ISO format timestamps
                    if (this.hasNonISOTimestamps(content)) {
                        console.debug(`[NEXUS-DEBUG] ConvertToISO8601Timestamps.verify: Still has non-ISO format timestamps in ${file.path}`);
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
    readonly description = "Fixes YAML syntax errors in conversation aliases. Properly quotes titles containing special characters (colons, brackets, etc.) to prevent frontmatter parsing errors.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const conversationFolder = context.plugin.settings.conversationFolder || context.plugin.settings.archiveFolder || "Nexus/Conversations";
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

            const conversationFolder = context.plugin.settings.conversationFolder || context.plugin.settings.archiveFolder || "Nexus/Conversations";
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
            let fixed = 0;
            let skipped = 0;
            let errors = 0;

            console.debug(`[NEXUS-DEBUG] FixFrontmatterAliases: Processing ${conversationFiles.length} files`);

            // Process files in smaller batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < conversationFiles.length; i += batchSize) {
                const batch = conversationFiles.slice(i, i + batchSize);


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


            console.debug(`[NEXUS-DEBUG] FixFrontmatterAliases: Completed - processed:${processed}, fixed:${fixed}, skipped:${skipped}, errors:${errors}`);

            const results: string[] = [];
            results.push(`**What this does:**`);
            results.push(`Fixes YAML syntax errors in conversation aliases caused by special characters.`);
            results.push(`Properly quotes titles containing colons, brackets, etc. to prevent parsing errors.`);
            results.push(``);
            results.push(`**Summary:**`);
            results.push(``);
            results.push(`- Total files scanned: ${processed}`);
            results.push(`- Fixed: ${fixed}`);
            results.push(`- Skipped (non-Nexus): ${skipped}`);
            if (errors > 0) {
                results.push(`- Errors: ${errors}`);
            }

            return {
                success: errors === 0,
                message: `Fixed ${fixed} conversation(s) with problematic aliases.`,
                details: results
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
            (_m, aliasValue) => {
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
            const conversationFolder = context.plugin.settings.conversationFolder || context.plugin.settings.archiveFolder || "Nexus/Conversations";
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
 * - Move Reports folder from <conversations>/Reports to ../Nexus Reports
 * - Create reportFolder and attachmentFolder settings
 * - Remove deprecated settings
 */
class MigrateToSeparateFoldersOperation extends UpgradeOperation {
    readonly id = "migrate-to-separate-folders";
    readonly name = "Update Folder Settings";
    readonly description = "Updates plugin settings to use separate folders for Conversations, Reports, and Attachments. Moves Reports folder out of Conversations for better organization.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        // Run if old archiveFolder setting exists
        return !!context.plugin.settings.archiveFolder;
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const results: string[] = [];

        try {
            results.push(`**What this does:**`);
            results.push(`This updates your plugin settings to use separate folders for better organization:`);
            results.push(`- **Conversations**: Your chat notes`);
            results.push(`- **Reports**: Import and upgrade reports (moved to "Nexus Reports")`);
            results.push(`- **Attachments**: Files, images, and Claude artifacts`);
            results.push(``);

            console.debug(`[MigrateToSeparateFolders] Starting migration...`);
            console.debug(`[MigrateToSeparateFolders] Current settings:`, {
                conversationFolder: context.plugin.settings.conversationFolder,
                reportFolder: context.plugin.settings.reportFolder,
                attachmentFolder: context.plugin.settings.attachmentFolder,
                archiveFolder: context.plugin.settings.archiveFolder
            });

            results.push(`**Settings updated:**`);
            results.push(``);

            // Only migrate if new settings don't exist yet
            if (!context.plugin.settings.conversationFolder) {
                const oldArchiveFolder = context.plugin.settings.archiveFolder || "Nexus/Conversations";
                console.debug(`[MigrateToSeparateFolders] Migrating from archiveFolder: ${oldArchiveFolder}`);

                // Set conversation folder
                context.plugin.settings.conversationFolder = oldArchiveFolder;

                // Calculate new Reports path: move from <conversations>/Reports to ../Nexus Reports
                const oldReportPath = `${oldArchiveFolder}/Reports`;
                const parentPath = oldArchiveFolder.split('/').slice(0, -1).join('/');
                const newReportPath = parentPath ? `${parentPath}/Nexus Reports` : 'Nexus Reports';

                // Try to move Reports folder if it exists
                const oldReportFolder = context.plugin.app.vault.getAbstractFileByPath(oldReportPath);
                let reportsMoved = false;

                if (oldReportFolder && oldReportFolder instanceof TFolder) {
                    try {
                        console.debug(`[MigrateToSeparateFolders] Moving Reports: ${oldReportPath} → ${newReportPath}`);
                        await context.plugin.app.vault.rename(oldReportFolder, newReportPath);
                        reportsMoved = true;
                        console.debug(`[MigrateToSeparateFolders] Reports folder moved successfully`);
                    } catch (error) {
                        console.error(`[MigrateToSeparateFolders] Failed to move Reports folder:`, error);
                        // Fallback: keep old path if move fails
                        context.plugin.settings.reportFolder = oldReportPath;
                        results.push(`- Reports: \`${oldReportPath}\` (move failed, kept in old location)`);
                    }
                }

                // Set report folder to new path (or old if move failed)
                if (reportsMoved || !oldReportFolder) {
                    context.plugin.settings.reportFolder = newReportPath;
                    if (reportsMoved) {
                        results.push(`- Reports: \`${oldReportPath}\` → \`${newReportPath}\` ✅`);
                    } else {
                        results.push(`- Reports: \`${newReportPath}\` (folder will be created on next import)`);
                    }
                }

                results.push(`- Conversations: \`${context.plugin.settings.conversationFolder}\``);
            } else {
                console.debug(`[MigrateToSeparateFolders] New settings already exist, keeping them`);
                results.push(`- Conversations: \`${context.plugin.settings.conversationFolder}\` (already configured)`);
                results.push(`- Reports: \`${context.plugin.settings.reportFolder}\` (already configured)`);
            }

            // Migrate attachmentFolder (keep existing or set default)
            if (!context.plugin.settings.attachmentFolder) {
                context.plugin.settings.attachmentFolder = "Nexus/Attachments";
                results.push(`- Attachments: \`${context.plugin.settings.attachmentFolder}\``);
            } else {
                results.push(`- Attachments: \`${context.plugin.settings.attachmentFolder}\` (already configured)`);
            }

            // Migrate conversationPageSize to lastConversationsPerPage
            if (!context.plugin.settings.lastConversationsPerPage) {
                if (context.plugin.settings.conversationPageSize) {
                    context.plugin.settings.lastConversationsPerPage = context.plugin.settings.conversationPageSize;
                } else {
                    context.plugin.settings.lastConversationsPerPage = 50;
                }
            }

            // Remove deprecated settings (only if they exist)
            let removedCount = 0;

            if (context.plugin.settings.archiveFolder !== undefined) {
                delete context.plugin.settings.archiveFolder;
                removedCount++;
            }
            if (context.plugin.settings.importAttachments !== undefined) {
                delete context.plugin.settings.importAttachments;
                removedCount++;
            }
            if (context.plugin.settings.skipMissingAttachments !== undefined) {
                delete context.plugin.settings.skipMissingAttachments;
                removedCount++;
            }
            if (context.plugin.settings.showAttachmentDetails !== undefined) {
                delete context.plugin.settings.showAttachmentDetails;
                removedCount++;
            }
            if (context.plugin.settings.defaultImportMode !== undefined) {
                delete context.plugin.settings.defaultImportMode;
                removedCount++;
            }
            if (context.plugin.settings.rememberLastImportMode !== undefined) {
                delete context.plugin.settings.rememberLastImportMode;
                removedCount++;
            }
            if (context.plugin.settings.conversationPageSize !== undefined) {
                delete context.plugin.settings.conversationPageSize;
                removedCount++;
            }
            if (context.plugin.settings.autoSelectAllOnOpen !== undefined) {
                delete context.plugin.settings.autoSelectAllOnOpen;
                removedCount++;
            }

            if (removedCount > 0) {
                results.push(``);
                results.push(`Cleaned up ${removedCount} deprecated setting(s).`);
            }

            await context.plugin.saveSettings();

            console.debug(`[MigrateToSeparateFolders] Migration completed successfully`);

            return {
                success: true,
                message: "Settings updated successfully. Your files were not moved.",
                details: results
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[MigrateToSeparateFolders] Failed:`, error);
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
 * Migrate Claude artifacts to new format:
 * 1. Remove redundant header (Type/Language/Command/Version/ID/UUID)
 * 2. Add conversation link if missing
 * 3. Add create_time to frontmatter
 */
class MigrateClaudeArtifactsOperation extends UpgradeOperation {
    readonly id = "migrate-claude-artifacts";
    readonly name = "Migrate Claude Artifacts";
    readonly description = "Updates existing Claude artifacts: removes redundant header information (already in frontmatter), adds missing conversation links, and adds creation timestamps for better organization.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const attachmentFolder = context.plugin.settings.attachmentFolder || "Nexus AI Chat Imports/Attachments";
            const claudeArtifactsPath = `${attachmentFolder}/claude/artifacts`;

            // Check if Claude artifacts folder exists
            const folder = context.plugin.app.vault.getAbstractFileByPath(claudeArtifactsPath);
            if (!folder || !(folder instanceof TFolder)) {
                console.debug(`[NEXUS-UPGRADE] MigrateClaudeArtifacts.canRun - No Claude artifacts folder found`);
                return false;
            }

            // Get all artifact files
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            const artifactFiles = allFiles.filter(file => file.path.startsWith(claudeArtifactsPath));

            if (artifactFiles.length === 0) {
                console.debug(`[NEXUS-UPGRADE] MigrateClaudeArtifacts.canRun - No artifact files found`);
                return false;
            }

            // Check if any artifacts need migration (missing create_time or has old header)
            for (const file of artifactFiles) {
                const fm = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter as any;
                if (!fm || fm.provider !== 'claude') continue;

                // Check if create_time is missing
                if (!fm.create_time) {
                    console.debug(`[NEXUS-UPGRADE] MigrateClaudeArtifacts.canRun - Found artifact without create_time`);
                    return true;
                }

                // Check if old header exists (read file content)
                const content = await context.plugin.app.vault.read(file);
                if (content.includes('**Type:** Claude Artifact') ||
                    content.includes('**Command:**') ||
                    content.includes('**UUID:**')) {
                    console.debug(`[NEXUS-UPGRADE] MigrateClaudeArtifacts.canRun - Found artifact with old header`);
                    return true;
                }
            }

            console.debug(`[NEXUS-UPGRADE] MigrateClaudeArtifacts.canRun - No artifacts need migration`);
            return false;
        } catch (error) {
            console.error(`[NEXUS-UPGRADE] MigrateClaudeArtifacts.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const results: string[] = [];
        let totalFiles = 0;
        let processedCount = 0;
        let skippedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        let warningCount = 0;

        try {
            const attachmentFolder = context.plugin.settings.attachmentFolder || "Nexus AI Chat Imports/Attachments";
            const conversationFolder = context.plugin.settings.conversationFolder || "Nexus/Conversations";
            const claudeArtifactsPath = `${attachmentFolder}/claude/artifacts`;

            // Get all artifact files
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            const artifactFiles = allFiles.filter(file => file.path.startsWith(claudeArtifactsPath));
            totalFiles = artifactFiles.length;

            results.push(`**What this does:**`);
            results.push(`Updates your existing Claude artifacts to the new format:`);
            results.push(`- Removes redundant header information (Type, Language, Command, etc.)`);
            results.push(`- Adds missing conversation links`);
            results.push(`- Adds creation timestamps for better organization`);
            results.push(``);
            results.push(`**Processing ${totalFiles} artifact file(s)...**`);
            results.push(``);

            for (const file of artifactFiles) {
                try {
                    console.debug(`[NEXUS-UPGRADE] ========================================`);
                    console.debug(`[NEXUS-UPGRADE] Processing artifact file: ${file.basename}`);

                    const fm = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter as any;
                    if (!fm || fm.provider !== 'claude') {
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: Skipped (not a Claude artifact)`);
                        skippedCount++;
                        continue;
                    }

                    processedCount++;
                    console.debug(`[NEXUS-UPGRADE] ${file.basename}: Claude artifact detected (ID: ${fm.artifact_id}, Version: ${fm.version_number})`);

                    let content = await context.plugin.app.vault.read(file);
                    let modified = false;
                    let warnings: string[] = [];

                    // Extract frontmatter and body
                    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                    if (!fmMatch) {
                        errorCount++;
                        results.push(`❌ ${file.basename}: Invalid frontmatter format`);
                        continue;
                    }

                    let frontmatter = fmMatch[1];
                    let body = fmMatch[2];

                    // TASK 1: Add create_time if missing
                    if (!fm.create_time) {
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 1 - Adding create_time (currently missing)`);

                        const createTime = await this.extractArtifactCreateTime(
                            fm,
                            conversationFolder,
                            context.plugin,
                            file
                        );

                        if (createTime.source === 'message') {
                            frontmatter += `\ncreate_time: ${createTime.value}`;
                            modified = true;
                            console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 1 - Added create_time from message: ${createTime.value}`);
                        } else if (createTime.source === 'conversation') {
                            frontmatter += `\ncreate_time: ${createTime.value}`;
                            warnings.push(`Used conversation create_time (message not found)`);
                            warningCount++;
                            modified = true;
                            console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 1 - Added create_time from conversation (fallback): ${createTime.value}`);
                        } else {
                            warnings.push(`Could not determine create_time`);
                            warningCount++;
                            console.warn(`[NEXUS-UPGRADE] ${file.basename}: TASK 1 - FAILED to determine create_time`);
                        }
                    } else {
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 1 - Skipped (create_time already exists: ${fm.create_time})`);
                    }

                    // TASK 2: Remove old header (Type/Language/Command/Version/ID/UUID)
                    console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 2 - Checking for old header to remove`);
                    const headerRegex = /\n\n\*\*Type:\*\* Claude Artifact\n\*\*Language:\*\*[^\n]*(?:\n\*\*Command:\*\*[^\n]*)?(?:\n\*\*Version:\*\*[^\n]*)?(?:\n\*\*ID:\*\*[^\n]*)?(?:\n\*\*UUID:\*\*[^\n]*)?/;
                    if (headerRegex.test(body)) {
                        body = body.replace(headerRegex, '');
                        modified = true;
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 2 - Removed old header`);
                    } else {
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 2 - Skipped (no old header found)`);
                    }

                    // TASK 3: Add conversation link if missing
                    console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 3 - Checking for conversation link`);
                    if (!body.includes('**Conversation:**') && fm.conversation_id) {
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 3 - Conversation link missing, searching for conversation ${fm.conversation_id}`);

                        const conversationLink = await this.findConversationLink(
                            fm.conversation_id,
                            conversationFolder,
                            context.plugin
                        );

                        if (conversationLink) {
                            // Insert after title
                            const titleMatch = body.match(/^# [^\n]+\n/);
                            if (titleMatch) {
                                const insertPos = titleMatch[0].length;
                                body = body.substring(0, insertPos) +
                                       `\n**Conversation:** ${conversationLink}\n` +
                                       body.substring(insertPos);
                                modified = true;
                                console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 3 - Added conversation link`);
                            } else {
                                console.warn(`[NEXUS-UPGRADE] ${file.basename}: TASK 3 - Could not find title to insert link after`);
                            }
                        } else {
                            warnings.push(`Conversation note not found (ID: ${fm.conversation_id})`);
                            warningCount++;
                            console.warn(`[NEXUS-UPGRADE] ${file.basename}: TASK 3 - Conversation note not found for ID ${fm.conversation_id}`);
                        }
                    } else if (body.includes('**Conversation:**')) {
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 3 - Skipped (conversation link already exists)`);
                    } else {
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: TASK 3 - Skipped (no conversation_id in frontmatter)`);
                    }

                    // Write back if modified
                    if (modified) {
                        // Update plugin_version to 1.3.0
                        frontmatter = frontmatter.replace(
                            /^plugin_version: ".*?"$/m,
                            `plugin_version: "1.3.0"`
                        );

                        const newContent = `---\n${frontmatter}\n---\n${body}`;
                        await context.plugin.app.vault.modify(file, newContent);
                        updatedCount++;
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: ✅ UPDATED (${warnings.length} warning(s))`);

                        if (warnings.length > 0) {
                            results.push(`⚠️  ${file.basename}: ${warnings.join(', ')}`);
                        }
                    } else {
                        console.debug(`[NEXUS-UPGRADE] ${file.basename}: No changes needed`);
                    }

                    console.debug(`[NEXUS-UPGRADE] ========================================`);

                } catch (error: any) {
                    errorCount++;
                    console.error(`[NEXUS-UPGRADE] ${file.basename}: ❌ ERROR:`, error);
                    results.push(`❌ ${file.basename}: ${error.message}`);
                }
            }

            results.push(``);
            results.push(`**Summary:**`);
            results.push(``);
            results.push(`- Total files found: ${totalFiles}`);
            results.push(`- Claude artifacts: ${processedCount}`);
            results.push(`- Skipped (non-Claude): ${skippedCount}`);
            results.push(`- Updated: ${updatedCount}`);
            results.push(`- Warnings: ${warningCount}`);
            results.push(`- Errors: ${errorCount}`);
            results.push(``);

            if (skippedCount > 0) {
                results.push(`*Note: ${skippedCount} file(s) were skipped because they are not Claude artifacts.*`);
            }

            return {
                success: errorCount === 0,
                message: `Migrated ${updatedCount} artifact(s) with ${warningCount} warning(s) and ${errorCount} error(s)`,
                details: results
            };

        } catch (error: any) {
            return {
                success: false,
                message: `Migration failed: ${error.message}`,
                details: results
            };
        }
    }

    /**
     * Extract artifact create_time from conversation note
     */
    private async extractArtifactCreateTime(
        artifactFm: any,
        conversationFolder: string,
        plugin: NexusAiChatImporterPlugin,
        artifactFile: any
    ): Promise<{value: string, source: 'message' | 'conversation' | 'none'}> {
        const artifactId = artifactFm.artifact_id;
        const versionNumber = artifactFm.version_number;
        const conversationId = artifactFm.conversation_id;
        const artifactRef = `${artifactId}_v${versionNumber}`;

        try {
            console.debug(`[NEXUS-UPGRADE] === Extracting create_time for artifact: ${artifactRef} ===`);

            if (!conversationId) {
                console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: No conversation_id in frontmatter`);
                return {value: '', source: 'none'};
            }

            console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Searching in conversation ${conversationId}`);

            // Find conversation note
            const conversationFile = await this.findConversationFile(conversationId, conversationFolder, plugin);
            if (!conversationFile) {
                console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Conversation file not found for ID ${conversationId}`);
                return {value: '', source: 'none'};
            }

            console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Found conversation file: ${conversationFile.basename}`);

            // Read conversation content
            const content = await plugin.app.vault.read(conversationFile);

            if (!artifactId || !versionNumber) {
                console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Missing artifact_id or version_number, using conversation fallback`);
                // Fallback to conversation create_time
                const fm = plugin.app.metadataCache.getFileCache(conversationFile)?.frontmatter as any;
                if (fm?.create_time) {
                    console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Using conversation create_time: ${fm.create_time}`);
                    return {value: fm.create_time, source: 'conversation'};
                }
                return {value: '', source: 'none'};
            }

            // Extract artifact file path (without .md extension) for exact link matching
            const artifactLinkPath = artifactFile.path.replace(/\.md$/, '');
            console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Searching for exact link: [[${artifactLinkPath}|View Artifact]]`);

            // Escape special regex characters in the path
            const escapedPath = artifactLinkPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Search for the exact artifact link
            const linkPattern = new RegExp(`\\[\\[${escapedPath}\\|View Artifact\\]\\]`, 'm');
            const linkMatch = content.match(linkPattern);

            if (!linkMatch || linkMatch.index === undefined) {
                console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Artifact link not found in conversation, using conversation fallback`);
                // Fallback to conversation create_time
                const fm = plugin.app.metadataCache.getFileCache(conversationFile)?.frontmatter as any;
                if (fm?.create_time) {
                    console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Using conversation create_time fallback: ${fm.create_time}`);
                    return {value: fm.create_time, source: 'conversation'};
                }
                return {value: '', source: 'none'};
            }

            const linkIndex = linkMatch.index;
            console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Found artifact link at position ${linkIndex}`);

            // Get all text BEFORE the artifact link
            const textBeforeLink = content.substring(0, linkIndex);

            // DEBUG: Show context around the artifact link (last 300 chars before link)
            const contextStart = Math.max(0, linkIndex - 300);
            const contextText = content.substring(contextStart, linkIndex);
            console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Context before link (last 300 chars):\n${contextText}\n[ARTIFACT LINK HERE]`);

            // Find the LAST nexus_agent callout before the link (the parent message)
            // Pattern matches: >[!nexus_agent] **Assistant** - <timestamp>
            // Allow optional whitespace at end of line
            const agentPattern = />\\[!nexus_agent\\] \\*\\*Assistant\\*\\* - (.+?)\s*$/gm;
            let lastMatch = null;
            let match;
            let matchCount = 0;

            console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Searching for agent callout pattern in ${textBeforeLink.length} chars`);
            console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Pattern: />${agentPattern.source}/gm`);

            while ((match = agentPattern.exec(textBeforeLink)) !== null) {
                matchCount++;
                lastMatch = match;
                console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Found agent callout #${matchCount} at position ${match.index}: "${match[1]}"`);
            }

            console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Total agent callouts found: ${matchCount}`);

            if (lastMatch && lastMatch[1]) {
                const timestampStr = lastMatch[1];
                console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Selected LAST agent callout timestamp: "${timestampStr}"`);

                // Parse timestamp with DateParser (with context for better logging)
                const timestamp = DateParser.parseDate(timestampStr, artifactRef);

                if (timestamp > 0) {
                    const isoDate = new Date(timestamp * 1000).toISOString();
                    console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: ✅ Successfully parsed message timestamp: ${isoDate}`);
                    return {
                        value: isoDate,
                        source: 'message'
                    };
                } else {
                    console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: ❌ Timestamp parsing FAILED (returned 0), using conversation fallback`);
                    console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Failed timestamp string was: "${timestampStr}"`);
                }
            } else {
                console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: ❌ No agent callout found before artifact link, using conversation fallback`);

                // DEBUG: Show a sample of what we were searching in
                const sampleText = textBeforeLink.substring(Math.max(0, textBeforeLink.length - 500));
                console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Last 500 chars of search text:\n${sampleText}`);
            }

            // Fallback to conversation create_time
            const fm = plugin.app.metadataCache.getFileCache(conversationFile)?.frontmatter as any;
            if (fm?.create_time) {
                console.debug(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Using conversation create_time fallback: ${fm.create_time}`);
                return {value: fm.create_time, source: 'conversation'};
            }

            console.warn(`[NEXUS-UPGRADE] Artifact ${artifactRef}: No create_time available`);
            return {value: '', source: 'none'};

        } catch (error) {
            console.error(`[NEXUS-UPGRADE] Artifact ${artifactRef}: Exception during create_time extraction:`, error);
            return {value: '', source: 'none'};
        }
    }

    /**
     * Find conversation file by ID
     */
    private async findConversationFile(
        conversationId: string,
        conversationFolder: string,
        plugin: NexusAiChatImporterPlugin
    ): Promise<any> {
        const allFiles = plugin.app.vault.getMarkdownFiles();
        const claudePath = `${conversationFolder}/claude`;

        for (const file of allFiles) {
            if (!file.path.startsWith(claudePath)) continue;

            const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter as any;
            if (fm?.conversation_id === conversationId) {
                return file;
            }
        }

        return null;
    }

    /**
     * Find and generate conversation link
     */
    private async findConversationLink(
        conversationId: string,
        conversationFolder: string,
        plugin: NexusAiChatImporterPlugin
    ): Promise<string | null> {
        const conversationFile = await this.findConversationFile(conversationId, conversationFolder, plugin);
        if (!conversationFile) {
            return null;
        }

        const fm = plugin.app.metadataCache.getFileCache(conversationFile)?.frontmatter as any;
        const title = fm?.aliases || conversationFile.basename;

        // Remove .md extension from path for Obsidian links
        const linkPath = conversationFile.path.replace(/\.md$/, '');
        return `[[${linkPath}|${title}]]`;
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            const attachmentFolder = context.plugin.settings.attachmentFolder || "Nexus AI Chat Imports/Attachments";
            const claudeArtifactsPath = `${attachmentFolder}/claude/artifacts`;

            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            const artifactFiles = allFiles.filter(file => file.path.startsWith(claudeArtifactsPath));

            // Verify all artifacts have create_time
            for (const file of artifactFiles) {
                const fm = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter as any;
                if (fm?.provider === 'claude' && !fm.create_time) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(`MigrateClaudeArtifacts.verify failed:`, error);
            return false;
        }
    }
}

/**
 * Configure folder locations and optionally migrate files
 * This is a BLOCKING operation that shows a dialog and waits for user input
 */
class ConfigureFolderLocationsOperation extends UpgradeOperation {
    readonly id = "configure-folder-locations";
    readonly name = "Configure Folder Locations";
    readonly description = "Configure separate folder locations for conversations, reports, and attachments. Optionally migrate existing files to new locations.";
    readonly type = "automatic" as const;

    async canRun(_context: UpgradeContext): Promise<boolean> {
        // Always run - this is the final step to let user configure folders
        return true;
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        console.debug(`[NEXUS-UPGRADE] ConfigureFolderLocations.execute starting`);

        return new Promise<OperationResult>((resolve) => {
            const dialog = new ConfigureFolderLocationsDialog(
                context.plugin,
                async (result: FolderConfigurationResult) => {
                    console.debug(`[NEXUS-UPGRADE] ConfigureFolderLocations - User completed configuration:`, result);

                    // Build result message
                    const details: string[] = [];

                    if (result.conversationFolder.changed) {
                        details.push(`✅ Conversation folder: ${result.conversationFolder.oldPath} → ${result.conversationFolder.newPath}`);
                    } else {
                        details.push(`ℹ️  Conversation folder: ${result.conversationFolder.newPath} (unchanged)`);
                    }

                    if (result.reportFolder.changed) {
                        details.push(`✅ Report folder: ${result.reportFolder.oldPath} → ${result.reportFolder.newPath}`);
                    } else {
                        details.push(`ℹ️  Report folder: ${result.reportFolder.newPath} (unchanged)`);
                    }

                    if (result.attachmentFolder.changed) {
                        details.push(`✅ Attachment folder: ${result.attachmentFolder.oldPath} → ${result.attachmentFolder.newPath}`);
                    } else {
                        details.push(`ℹ️  Attachment folder: ${result.attachmentFolder.newPath} (unchanged)`);
                    }

                    console.debug(`[NEXUS-UPGRADE] ConfigureFolderLocations.execute completed successfully`);

                    resolve({
                        success: true,
                        message: "Folder locations configured successfully",
                        details
                    });
                }
            );
            dialog.open();
        });
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
        new FixFrontmatterAliasesOperation(),
        new MigrateClaudeArtifactsOperation(),
        new ConfigureFolderLocationsOperation()
    ];

    readonly manualOperations = [
        // No manual operations for this version
    ];
}
