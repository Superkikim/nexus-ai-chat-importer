// src/upgrade/versions/upgrade-1.3.0.ts
import { VersionUpgrade, UpgradeOperation, UpgradeContext, OperationResult } from "../upgrade-interface";
import type NexusAiChatImporterPlugin from "../../main";

/**
 * Fix timestamp precision by adding seconds to all existing frontmatter timestamps
 * This resolves the issue where timestamps lose seconds precision when stored in frontmatter,
 * causing false positive "updated" conversations in the selection dialog.
 */
class FixTimestampPrecisionOperation extends UpgradeOperation {
    readonly id = "fix-timestamp-precision";
    readonly name = "Fix Timestamp Precision";
    readonly description = "Add seconds (:00) to all existing create_time and update_time frontmatter entries to resolve comparison issues";
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

            // Check if any files have timestamps without seconds
            for (const file of conversationFiles.slice(0, 10)) { // Sample first 10 files
                try {
                    const content = await context.plugin.app.vault.read(file);

                    // Check for timestamps without seconds (US format only as confirmed by testing)
                    if (this.hasTimestampsWithoutSeconds(content)) {
                        return true;
                    }
                } catch (error) {
                    console.error(`Error checking file ${file.path}:`, error);
                }
            }

            return false;
        } catch (error) {
            console.error(`FixTimestampPrecision.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] FixTimestampPrecision.execute starting`);

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
            let errors = 0;

            console.debug(`[NEXUS-DEBUG] FixTimestampPrecision: Processing ${conversationFiles.length} files`);

            // Process files in smaller batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < conversationFiles.length; i += batchSize) {
                const batch = conversationFiles.slice(i, i + batchSize);

                for (const file of batch) {
                    processed++;

                    try {
                        const content = await context.plugin.app.vault.read(file);

                        // Only process files with timestamps without seconds
                        if (!this.hasTimestampsWithoutSeconds(content)) {
                            continue;
                        }

                        const fixedContent = this.fixTimestampPrecision(content);

                        if (content !== fixedContent) {
                            // Update plugin_version to 1.3.0
                            const finalContent = this.updatePluginVersion(fixedContent, "1.3.0");
                            await context.plugin.app.vault.modify(file, finalContent);
                            fixed++;
                        }

                    } catch (error) {
                        errors++;
                        console.error(`[NEXUS-DEBUG] Error fixing timestamps in ${file.path}:`, error);
                    }
                }

                // Small delay between batches to prevent blocking
                if (i + batchSize < conversationFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            console.debug(`[NEXUS-DEBUG] FixTimestampPrecision: Completed - processed:${processed}, fixed:${fixed}, errors:${errors}`);

            return {
                success: errors === 0,
                message: `Timestamp precision fix completed: ${fixed} files updated, ${errors} errors`,
                details: { processed, fixed, errors }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] FixTimestampPrecision.execute failed:`, error);
            return {
                success: false,
                message: `Timestamp precision fix failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    /**
     * Check if content has timestamps without seconds (US format only)
     * Pattern: create_time: MM/DD/YYYY at H:MM AM/PM (missing :SS)
     */
    private hasTimestampsWithoutSeconds(content: string): boolean {
        // Simple approach: look for timestamps that match HH:MM pattern followed by AM/PM
        // but exclude those that already have HH:MM:SS pattern
        const lines = content.split('\n');

        for (const line of lines) {
            if (line.match(/^(create|update)_time:/)) {
                // Check if this line has time without seconds: HH:MM AM/PM
                if (line.match(/\d{1,2}:\d{2}\s+(AM|PM)$/)) {
                    // Make sure it's not HH:MM:SS AM/PM
                    if (!line.match(/\d{1,2}:\d{2}:\d{2}\s+(AM|PM)$/)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Fix timestamp precision by adding :00 seconds to timestamps without seconds
     */
    private fixTimestampPrecision(content: string): string {
        // Pattern specifically for US format (as confirmed by testing)
        // Matches: create_time: 01/15/2024 at 2:30 PM
        // Replaces with: create_time: 01/15/2024 at 2:30:00 PM
        // Use word boundary to ensure we capture the complete time pattern
        return content.replace(
            /^((?:create|update)_time: .+?\s+)(\d{1,2}:\d{2})(\s+(?:AM|PM))$/gm,
            (match, prefix, time, suffix) => {
                // Only add seconds if the time part has exactly 2 parts (HH:MM, not HH:MM:SS)
                const timeParts = time.split(':');
                if (timeParts.length === 2) {
                    return `${prefix}${time}:00${suffix}`;
                }
                return match; // Already has seconds or invalid format
            }
        );
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

                    // Check if still has timestamps without seconds
                    if (this.hasTimestampsWithoutSeconds(content)) {
                        console.debug(`[NEXUS-DEBUG] FixTimestampPrecision.verify: Still has timestamps without seconds in ${file.path}`);
                        return false;
                    }

                    // Check if plugin_version was updated
                    if (!content.includes('plugin_version: "1.3.0"')) {
                        console.debug(`[NEXUS-DEBUG] FixTimestampPrecision.verify: Missing v1.3.0 in ${file.path}`);
                        return false;
                    }

                } catch (error) {
                    console.error(`Error verifying file ${file.path}:`, error);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(`FixTimestampPrecision.verify failed:`, error);
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
        new FixTimestampPrecisionOperation()
    ];

    readonly manualOperations = [
        // No manual operations for this version
    ];
}
