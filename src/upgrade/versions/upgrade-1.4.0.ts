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


// src/upgrade/versions/upgrade-1.4.0.ts
import { VersionUpgrade, UpgradeOperation, UpgradeContext, OperationResult } from "../upgrade-interface";
import { TFolder } from "obsidian";
import { StorageService } from "../../services/storage-service";
import { LinkUpdateService } from "../../services/link-update-service";

/**
 * UUID pattern: 8-4-4-4-12 hex chars (e.g. "a3663666-58a8-4835-bef1-308fb59c8609")
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rename Claude artifact folders from UUID-based to human-readable names
 * matching the conversation file name.
 *
 * Before: Nexus/Attachments/claude/artifacts/<conversationId>/
 * After:  Nexus/Attachments/claude/artifacts/<conversationFileName>/
 */
class RenameClaudeArtifactFoldersOperation extends UpgradeOperation {
    readonly id = "rename-claude-artifact-folders";
    readonly name = "Rename Claude Artifact Folders";
    readonly description = "Renames Claude artifact folders from UUID to human-readable names matching the conversation file.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const attachmentFolder = context.plugin.settings.attachmentFolder || "Nexus/Attachments";
            const claudeArtifactsPath = `${attachmentFolder}/claude/artifacts`;

            const folder = context.plugin.app.vault.getAbstractFileByPath(claudeArtifactsPath);
            if (!folder || !(folder instanceof TFolder)) {
                return false;
            }

            // Check if any UUID-named subfolders exist
            for (const child of folder.children) {
                if (child instanceof TFolder && UUID_REGEX.test(child.name)) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(`[RenameClaudeArtifactFolders] canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        let renamedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const details: string[] = [];

        try {
            const attachmentFolder = context.plugin.settings.attachmentFolder || "Nexus/Attachments";
            const claudeArtifactsPath = `${attachmentFolder}/claude/artifacts`;

            const artifactsFolder = context.plugin.app.vault.getAbstractFileByPath(claudeArtifactsPath);
            if (!artifactsFolder || !(artifactsFolder instanceof TFolder)) {
                return {
                    success: true,
                    message: "No Claude artifacts folder found, nothing to migrate."
                };
            }

            // Collect UUID-named folders
            const uuidFolders: TFolder[] = [];
            for (const child of artifactsFolder.children) {
                if (child instanceof TFolder && UUID_REGEX.test(child.name)) {
                    uuidFolders.push(child);
                }
            }

            if (uuidFolders.length === 0) {
                return {
                    success: true,
                    message: "No UUID-named artifact folders found."
                };
            }

            // Build conversation lookup ONCE (avoid repeated full vault scans)
            context.onProgress?.(0, "Scanning conversation catalog...");
            const storageService = new StorageService(context.plugin);
            const conversationMap = await storageService.scanExistingConversations();

            const total = uuidFolders.length;
            const pathMappings: Array<{oldPath: string, newPath: string}> = [];

            for (let i = 0; i < uuidFolders.length; i++) {
                const folder = uuidFolders[i];
                const conversationId = folder.name;
                const progress = Math.round(((i + 1) / total) * 80); // 0-80% for renames

                try {
                    // Look up conversation file path from pre-built map
                    const entry = conversationMap.get(conversationId) || null;

                    if (!entry || !entry.path) {
                        skippedCount++;
                        details.push(`Skipped: ${conversationId} (conversation not found in vault)`);
                        context.onProgress?.(progress, `Skipped ${i + 1}/${total}`);
                        continue;
                    }

                    // Extract filename from path (e.g. "Nexus/Conversations/claude/2026/02/My Chat.md" → "My Chat")
                    const pathParts = entry.path.split('/');
                    const fileNameWithExt = pathParts[pathParts.length - 1];
                    const conversationFileName = fileNameWithExt.replace(/\.md$/, '');

                    if (!conversationFileName) {
                        skippedCount++;
                        details.push(`Skipped: ${conversationId} (could not determine file name)`);
                        context.onProgress?.(progress, `Skipped ${i + 1}/${total}`);
                        continue;
                    }

                    // Check if target folder already exists
                    const newFolderPath = `${claudeArtifactsPath}/${conversationFileName}`;
                    const existingTarget = context.plugin.app.vault.getAbstractFileByPath(newFolderPath);

                    if (existingTarget) {
                        skippedCount++;
                        details.push(`Skipped: ${conversationId} → "${conversationFileName}" (target folder already exists)`);
                        context.onProgress?.(progress, `Skipped ${i + 1}/${total}`);
                        continue;
                    }

                    // Rename the folder — vault.rename() updates internal links if Obsidian setting is enabled
                    const oldFolderPath = folder.path;
                    context.onProgress?.(progress, `Renaming ${i + 1}/${total}: ${conversationFileName}`);
                    await context.plugin.app.vault.rename(folder, newFolderPath);

                    pathMappings.push({ oldPath: oldFolderPath, newPath: newFolderPath });
                    renamedCount++;
                    details.push(`Renamed: ${conversationId} → "${conversationFileName}"`);

                } catch (error) {
                    errorCount++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    details.push(`Error: ${conversationId} — ${errorMsg}`);
                    context.onProgress?.(progress, `Error ${i + 1}/${total}`);
                }
            }

            // Fallback: fix any stale links in case "Automatically update internal links" is disabled.
            // Single pass through conversation files — no-op if Obsidian already updated the links.
            if (pathMappings.length > 0) {
                context.onProgress?.(80, "Verifying wikilinks...");

                const linkUpdateService = new LinkUpdateService(context.plugin);
                const linkStats = await linkUpdateService.updateAttachmentLinksBatch(pathMappings, (progress) => {
                    const overallProgress = 80 + Math.round((progress.current / Math.max(progress.total, 1)) * 20);
                    context.onProgress?.(overallProgress, progress.detail);
                });

                if (linkStats.filesModified > 0) {
                    details.push(`Fixed ${linkStats.attachmentLinksUpdated} stale link(s) in ${linkStats.filesModified} file(s)`);
                }
            }

            const summary = `Renamed ${renamedCount} folder(s), skipped ${skippedCount}, errors ${errorCount}.`;

            return {
                success: errorCount === 0,
                message: summary,
                details: details
            };

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Migration failed: ${errorMsg}`,
                details: details
            };
        }
    }
}

/**
 * Fix nested callout empty lines in conversation notes created by v1.3.x.
 *
 * In v1.3.x, the empty line before a nested callout used ">>" which breaks
 * the callout rendering in Obsidian. The correct pattern is ">" (single quote).
 *
 * Before: >>\n>>[!nexus_attachment]
 * After:  >\n>>[!nexus_attachment]
 */
class FixCalloutEmptyLinesOperation extends UpgradeOperation {
    readonly id = "fix-callout-empty-lines";
    readonly name = "Fix Callout Empty Lines";
    readonly description = "Fixes nested callout rendering in conversation notes created by previous versions.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const conversationFolder = context.plugin.settings.conversationFolder || "Nexus/Conversations";
            const folder = context.plugin.app.vault.getAbstractFileByPath(conversationFolder);
            return !!(folder && folder instanceof TFolder);
        } catch {
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        let fixedCount = 0;
        let scannedCount = 0;
        let errorCount = 0;
        const details: string[] = [];

        try {
            const conversationFolder = context.plugin.settings.conversationFolder || "Nexus/Conversations";

            // Get all markdown files under the conversation folder
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            const conversationFiles = allFiles.filter(f => f.path.startsWith(conversationFolder));

            // Pattern: ">>" on its own line followed by ">>[!nexus_"
            const brokenPattern = /^>>$/gm;
            const total = conversationFiles.length;

            for (let i = 0; i < conversationFiles.length; i++) {
                const file = conversationFiles[i];
                scannedCount++;
                const progress = Math.round(((i + 1) / total) * 100);

                // Report progress every 10 files or on last file to avoid excessive UI updates
                if (i % 10 === 0 || i === total - 1) {
                    context.onProgress?.(progress, `Scanning ${i + 1}/${total}: ${file.name}`);
                }

                try {
                    const content = await context.plugin.app.vault.read(file);

                    // Check if this file has the broken pattern
                    if (!brokenPattern.test(content)) {
                        continue;
                    }
                    // Reset regex lastIndex after test()
                    brokenPattern.lastIndex = 0;

                    // Replace ">>" empty lines with ">" — only when followed by a nexus callout
                    const fixed = content.replace(/^>>(\n>>\[!nexus_)/gm, '>$1');

                    if (fixed !== content) {
                        await context.plugin.app.vault.modify(file, fixed);
                        fixedCount++;
                        details.push(`Fixed: ${file.path}`);
                        context.onProgress?.(progress, `Fixed: ${file.name}`);
                    }
                } catch (error) {
                    errorCount++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    details.push(`Error: ${file.path} — ${errorMsg}`);
                }
            }

            const summary = `Scanned ${scannedCount} file(s), fixed ${fixedCount}, errors ${errorCount}.`;
            return {
                success: errorCount === 0,
                message: summary,
                details: details
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Migration failed: ${errorMsg}`,
                details: details
            };
        }
    }
}

/**
 * Version 1.4.0 Upgrade Definition
 */
export class Upgrade140 extends VersionUpgrade {
    readonly version = "1.4.0";

    readonly automaticOperations = [
        new RenameClaudeArtifactFoldersOperation(),
        new FixCalloutEmptyLinesOperation()
    ];

    readonly manualOperations = [
        // No manual operations for this version
    ];
}
