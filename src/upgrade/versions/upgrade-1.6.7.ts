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

// src/upgrade/versions/upgrade-1.6.7.ts
import {
    VersionUpgrade,
    UpgradeOperation,
    UpgradeContext,
    OperationResult,
} from "../upgrade-interface";
import { TFolder } from "obsidian";
import { LinkUpdateService } from "../../services/link-update-service";

const TARGET_VERSION = "1.6.7";

/**
 * Update plugin_version in frontmatter to the target version.
 */
function updatePluginVersion(content: string, version: string): string {
    if (content.includes("plugin_version:")) {
        return content.replace(
            /^plugin_version: .*$/m,
            `plugin_version: "${version}"`
        );
    }
    return content.replace(/\n---\n/, `\nplugin_version: "${version}"\n---\n`);
}

/**
 * Rename vault folders from `lechat` to `vibe` following the Mistral Vibe rebrand.
 *
 * Before: <conversationFolder>/lechat/
 *         <attachmentFolder>/lechat/
 *         <reportFolder>/lechat/
 * After:  <conversationFolder>/vibe/
 *         <attachmentFolder>/vibe/
 *         <reportFolder>/vibe/
 */
class RenameLeChatFoldersOperation extends UpgradeOperation {
    readonly id = "rename-lechat-to-vibe-folders";
    readonly name = "Rename Le Chat Folders to Mistral Vibe";
    readonly description =
        "Renames vault folders from 'lechat' to 'vibe' following the Mistral Vibe rebrand.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const { conversationFolder, attachmentFolder, reportFolder } =
                this.getFolderPaths(context);

            const pathsToCheck = [
                `${conversationFolder}/lechat`,
                `${attachmentFolder}/lechat`,
                `${reportFolder}/lechat`,
            ];

            return pathsToCheck.some((path) => {
                const item =
                    context.plugin.app.vault.getAbstractFileByPath(path);
                return item instanceof TFolder;
            });
        } catch {
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        let renamedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const details: string[] = [];
        const renamedMappings: Array<{ oldPath: string; newPath: string }> = [];

        try {
            const { conversationFolder, attachmentFolder, reportFolder } =
                this.getFolderPaths(context);

            const pathsToRename = [
                {
                    oldPath: `${conversationFolder}/lechat`,
                    newPath: `${conversationFolder}/vibe`,
                    label: "Conversations",
                },
                {
                    oldPath: `${attachmentFolder}/lechat`,
                    newPath: `${attachmentFolder}/vibe`,
                    label: "Attachments",
                },
                {
                    oldPath: `${reportFolder}/lechat`,
                    newPath: `${reportFolder}/vibe`,
                    label: "Reports",
                },
            ];

            const total = pathsToRename.length;

            for (let i = 0; i < total; i++) {
                const { oldPath, newPath, label } = pathsToRename[i];
                const progress = Math.round(((i + 1) / total) * 80);

                context.onProgress?.(progress, `Renaming ${label} folder...`);

                const folder =
                    context.plugin.app.vault.getAbstractFileByPath(oldPath);

                if (!folder || !(folder instanceof TFolder)) {
                    skippedCount++;
                    details.push(`Skipped: ${oldPath} (folder not found)`);
                    continue;
                }

                const existingTarget =
                    context.plugin.app.vault.getAbstractFileByPath(newPath);
                if (existingTarget) {
                    skippedCount++;
                    details.push(
                        `Skipped: ${oldPath} → ${newPath} (target already exists)`
                    );
                    continue;
                }

                try {
                    await context.plugin.app.vault.rename(folder, newPath);
                    renamedCount++;
                    renamedMappings.push({ oldPath, newPath });
                    details.push(`Renamed: ${oldPath} → ${newPath}`);
                } catch (error) {
                    errorCount++;
                    const errorMsg =
                        error instanceof Error ? error.message : String(error);
                    details.push(`Error: ${oldPath} — ${errorMsg}`);
                }
            }

            if (renamedMappings.length > 0) {
                const linkUpdateService = new LinkUpdateService(context.plugin);
                const { conversationFolder } = this.getFolderPaths(context);

                // Fix attachment links in conversation notes (lechat/ → vibe/)
                context.onProgress?.(
                    80,
                    "Updating attachment links in conversations..."
                );
                const attachmentStats =
                    await linkUpdateService.updateAttachmentLinksBatch(
                        renamedMappings,
                        (progress) => {
                            const overallProgress =
                                80 +
                                Math.round(
                                    (progress.current /
                                        Math.max(progress.total, 1)) *
                                        10
                                );
                            context.onProgress?.(
                                overallProgress,
                                progress.detail
                            );
                        },
                        TARGET_VERSION
                    );
                if (attachmentStats.filesModified > 0) {
                    details.push(
                        `Fixed ${attachmentStats.attachmentLinksUpdated} attachment link(s) in ${attachmentStats.filesModified} conversation(s)`
                    );
                }

                // Fix conversation links in reports (Conversations/lechat/ → Conversations/vibe/)
                context.onProgress?.(
                    90,
                    "Updating conversation links in reports..."
                );
                const reportStats =
                    await linkUpdateService.updateConversationLinks(
                        `${conversationFolder}/lechat`,
                        `${conversationFolder}/vibe`,
                        (progress) => {
                            const overallProgress =
                                90 +
                                Math.round(
                                    (progress.current /
                                        Math.max(progress.total, 1)) *
                                        10
                                );
                            context.onProgress?.(
                                overallProgress,
                                progress.detail
                            );
                        }
                    );
                if (reportStats.filesModified > 0) {
                    details.push(
                        `Updated ${reportStats.conversationLinksUpdated} conversation link(s) in ${reportStats.filesModified} report(s)`
                    );
                }
            }

            const summary = `Renamed ${renamedCount} folder(s), skipped ${skippedCount}, errors ${errorCount}.`;
            return {
                success: errorCount === 0,
                message: summary,
                details,
            };
        } catch (error) {
            const errorMsg =
                error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Migration failed: ${errorMsg}`,
                details,
            };
        }
    }

    private getFolderPaths(context: UpgradeContext) {
        return {
            conversationFolder:
                context.plugin.settings.conversationFolder ||
                "Nexus/Conversations",
            attachmentFolder:
                context.plugin.settings.attachmentFolder || "Nexus/Attachments",
            reportFolder:
                context.plugin.settings.reportFolder || "Nexus/Reports",
        };
    }
}

/**
 * Update `provider: lechat` to `provider: vibe` in all Mistral Vibe conversation frontmatter.
 *
 * Must run AFTER RenameLeChatFoldersOperation so files are already under <conversationFolder>/vibe/.
 */
class UpdateLeChatProviderInFrontmatterOperation extends UpgradeOperation {
    readonly id = "update-lechat-provider-in-frontmatter";
    readonly name = "Update Provider Field in Frontmatter";
    readonly description =
        "Updates 'provider: lechat' to 'provider: vibe' in all Mistral Vibe conversation notes.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const conversationFolder =
                context.plugin.settings.conversationFolder ||
                "Nexus/Conversations";
            const vibeFolder = `${conversationFolder}/vibe`;

            const folder =
                context.plugin.app.vault.getAbstractFileByPath(vibeFolder);
            if (!folder || !(folder instanceof TFolder)) {
                return false;
            }

            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            for (const file of allFiles) {
                if (!file.path.startsWith(vibeFolder)) continue;
                const frontmatter =
                    context.plugin.app.metadataCache.getFileCache(
                        file
                    )?.frontmatter;
                if (frontmatter?.provider === "lechat") {
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const details: string[] = [];

        try {
            const conversationFolder =
                context.plugin.settings.conversationFolder ||
                "Nexus/Conversations";
            const vibeFolder = `${conversationFolder}/vibe`;

            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            const vibeFiles = allFiles.filter((f) =>
                f.path.startsWith(vibeFolder)
            );

            const total = vibeFiles.length;

            for (let i = 0; i < total; i++) {
                const file = vibeFiles[i];
                const progress = Math.round(((i + 1) / total) * 100);

                if (i % 20 === 0 || i === total - 1) {
                    context.onProgress?.(
                        progress,
                        `Updating ${i + 1}/${total}: ${file.name}`
                    );
                }

                try {
                    const content = await context.plugin.app.vault.read(file);

                    if (!content.includes("provider: lechat")) {
                        skippedCount++;
                        continue;
                    }

                    let updated = content.replace(
                        /^provider: lechat$/m,
                        "provider: vibe"
                    );
                    updated = updatePluginVersion(updated, TARGET_VERSION);

                    await context.plugin.app.vault.modify(file, updated);
                    updatedCount++;
                    details.push(`Updated: ${file.path}`);
                } catch (error) {
                    errorCount++;
                    const errorMsg =
                        error instanceof Error ? error.message : String(error);
                    details.push(`Error: ${file.path} — ${errorMsg}`);
                }
            }

            const summary = `Updated ${updatedCount} file(s), skipped ${skippedCount}, errors ${errorCount}.`;
            return {
                success: errorCount === 0,
                message: summary,
                details,
            };
        } catch (error) {
            const errorMsg =
                error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Migration failed: ${errorMsg}`,
                details,
            };
        }
    }
}

/**
 * Update conversation links in import reports after the lechat → vibe folder rename.
 *
 * Reports contain links like [[Nexus/Conversations/lechat/...]] that become stale
 * once the conversation folder is renamed. This operation scans all report files and
 * replaces those references with [[Nexus/Conversations/vibe/...]].
 *
 * Runs independently of the folder rename so it can fix reports even when the
 * rename already completed in a previous session without this step.
 */
class UpdateReportConversationLinksOperation extends UpgradeOperation {
    readonly id = "update-report-conversation-links";
    readonly name = "Update Conversation Links in Reports";
    readonly description =
        "Updates stale 'lechat/' conversation links in import reports to 'vibe/'.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const conversationFolder =
                context.plugin.settings.conversationFolder ||
                "Nexus/Conversations";
            const oldPrefix = `${conversationFolder}/lechat`;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            for (const file of allFiles) {
                const content = await context.plugin.app.vault.read(file);
                if (content.includes(oldPrefix)) {
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const details: string[] = [];
        try {
            const conversationFolder =
                context.plugin.settings.conversationFolder ||
                "Nexus/Conversations";
            const linkUpdateService = new LinkUpdateService(context.plugin);

            context.onProgress?.(
                0,
                "Updating conversation links in reports..."
            );
            const stats = await linkUpdateService.updateConversationLinks(
                `${conversationFolder}/lechat`,
                `${conversationFolder}/vibe`,
                (progress) => {
                    const overallProgress = Math.round(
                        (progress.current / Math.max(progress.total, 1)) * 100
                    );
                    context.onProgress?.(overallProgress, progress.detail);
                }
            );

            if (stats.filesModified > 0) {
                details.push(
                    `Updated ${stats.conversationLinksUpdated} link(s) in ${stats.filesModified} report(s)`
                );
            }

            const summary = `Scanned ${stats.reportsScanned} report(s), updated ${stats.filesModified} file(s).`;
            return { success: true, message: summary, details };
        } catch (error) {
            const errorMsg =
                error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Migration failed: ${errorMsg}`,
                details,
            };
        }
    }
}

/**
 * Version 1.6.7 Upgrade Definition
 * Renames Le Chat provider to Mistral Vibe across the vault.
 */
export class Upgrade167 extends VersionUpgrade {
    readonly version = "1.6.7";

    readonly automaticOperations: UpgradeOperation[] = [
        new RenameLeChatFoldersOperation(),
        new UpdateLeChatProviderInFrontmatterOperation(),
        new UpdateReportConversationLinksOperation(),
    ];

    readonly manualOperations: UpgradeOperation[] = [];
}
