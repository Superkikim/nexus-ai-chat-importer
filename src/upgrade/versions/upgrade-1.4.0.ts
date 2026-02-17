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
import { TFile, TFolder } from "obsidian";
import { StorageService } from "../../services/storage-service";
import { LinkUpdateService } from "../../services/link-update-service";

/**
 * UUID pattern: 8-4-4-4-12 hex chars (e.g. "a3663666-58a8-4835-bef1-308fb59c8609")
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TARGET_VERSION = "1.4.0";

/**
 * Update plugin_version in frontmatter to the target version.
 * Handles both existing and missing plugin_version fields.
 */
function updatePluginVersion(content: string, version: string): string {
    if (content.includes('plugin_version:')) {
        return content.replace(
            /^plugin_version: .*$/m,
            `plugin_version: "${version}"`
        );
    }
    // Add plugin_version before the closing --- of frontmatter
    return content.replace(
        /\n---\n/,
        `\nplugin_version: "${version}"\n---\n`
    );
}

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
                }, TARGET_VERSION);

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
 * Restore missing artifact callouts in Claude conversation notes.
 *
 * Due to a change in Anthropic's Claude export format, conversations imported
 * with v1.3.x have artifacts saved on disk but no [!nexus_artifact] callouts
 * in the conversation notes. This operation scans artifact folders, matches
 * them to conversation notes, and appends artifact callout links.
 */
class RestoreMissingArtifactCalloutsOperation extends UpgradeOperation {
    readonly id = "restore-missing-artifact-callouts";
    readonly name = "Restore Missing Artifact Callouts";
    readonly description = "Restores artifact links in Claude conversation notes affected by Anthropic's export format change.";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const attachmentFolder = context.plugin.settings.attachmentFolder || "Nexus/Attachments";
            const claudeArtifactsPath = `${attachmentFolder}/claude/artifacts`;

            const folder = context.plugin.app.vault.getAbstractFileByPath(claudeArtifactsPath);
            return !!(folder && folder instanceof TFolder && folder.children.length > 0);
        } catch {
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        let restoredCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const details: string[] = [];

        try {
            const attachmentFolder = context.plugin.settings.attachmentFolder || "Nexus/Attachments";
            const claudeArtifactsPath = `${attachmentFolder}/claude/artifacts`;

            const artifactsRoot = context.plugin.app.vault.getAbstractFileByPath(claudeArtifactsPath);
            if (!artifactsRoot || !(artifactsRoot instanceof TFolder)) {
                return { success: true, message: "No Claude artifacts folder found." };
            }

            // Collect artifact subfolders
            const artifactFolders: TFolder[] = [];
            for (const child of artifactsRoot.children) {
                if (child instanceof TFolder) {
                    artifactFolders.push(child);
                }
            }

            if (artifactFolders.length === 0) {
                return { success: true, message: "No artifact folders found." };
            }

            // Build conversation lookup
            context.onProgress?.(0, "Scanning conversation catalog...");
            const storageService = new StorageService(context.plugin);
            const conversationMap = await storageService.scanExistingConversations();

            const total = artifactFolders.length;

            for (let i = 0; i < artifactFolders.length; i++) {
                const folder = artifactFolders[i];
                const progress = Math.round(((i + 1) / total) * 100);

                if (i % 10 === 0 || i === total - 1) {
                    context.onProgress?.(progress, `Checking ${i + 1}/${total}: ${folder.name}`);
                }

                try {
                    // Collect .md artifact files in this folder
                    const artifactFiles = folder.children.filter(
                        (f): f is TFile => f instanceof TFile && f.extension === 'md'
                    );

                    if (artifactFiles.length === 0) {
                        continue;
                    }

                    // Read one artifact to get conversation_id
                    const sampleContent = await context.plugin.app.vault.read(artifactFiles[0]);
                    const conversationId = this.extractFrontmatterField(sampleContent, 'conversation_id');

                    if (!conversationId) {
                        skippedCount++;
                        details.push(`Skipped: ${folder.name} (no conversation_id in artifact)`);
                        continue;
                    }

                    // Find conversation note
                    const entry = conversationMap.get(conversationId);
                    if (!entry || !entry.path) {
                        skippedCount++;
                        details.push(`Skipped: ${folder.name} (conversation not found in vault)`);
                        continue;
                    }

                    const noteFile = context.plugin.app.vault.getAbstractFileByPath(entry.path);
                    if (!noteFile || !(noteFile instanceof TFile)) {
                        skippedCount++;
                        continue;
                    }

                    // Check if note already has artifact callouts
                    const noteContent = await context.plugin.app.vault.read(noteFile);
                    if (noteContent.includes('nexus_artifact')) {
                        skippedCount++;
                        continue;
                    }

                    // Parse all artifact files and build callouts
                    const artifactEntries: Array<{
                        artifactId: string;
                        versionNumber: number;
                        title: string;
                        filePath: string;
                    }> = [];

                    for (const artFile of artifactFiles) {
                        const artContent = await context.plugin.app.vault.read(artFile);
                        const artifactId = this.extractFrontmatterField(artContent, 'artifact_id') || 'unknown';
                        const versionStr = this.extractFrontmatterField(artContent, 'version_number');
                        const versionNumber = versionStr ? parseInt(versionStr, 10) : 1;
                        const title = this.extractArtifactTitle(artContent, artifactId);

                        // Build artifact link path (without .md extension for wikilinks)
                        const filePath = artFile.path.replace(/\.md$/, '');

                        artifactEntries.push({ artifactId, versionNumber, title, filePath });
                    }

                    // Sort: by artifact_id, then by version_number
                    artifactEntries.sort((a, b) => {
                        const idCmp = a.artifactId.localeCompare(b.artifactId);
                        return idCmp !== 0 ? idCmp : a.versionNumber - b.versionNumber;
                    });

                    // Build callout section
                    const calloutLines = artifactEntries.map(art =>
                        `>[!nexus_artifact] **${art.title}** v${art.versionNumber}\n> 🎨 [[${art.filePath}|View Artifact]]`
                    );

                    const section = [
                        '',
                        '---',
                        '> [!info] Restored Artifacts',
                        '> Due to a change in Anthropic\'s Claude export format, artifact references were not included when this conversation was originally imported. The artifacts below have been restored during the v1.4.0 migration.',
                        '> To get artifacts positioned inline within messages, delete this note and re-import from your Claude export ZIP.',
                        '',
                        ...calloutLines,
                    ].join('\n');

                    // Append to note and update plugin_version
                    let updatedContent = noteContent + section + '\n';
                    updatedContent = updatePluginVersion(updatedContent, TARGET_VERSION);
                    await context.plugin.app.vault.modify(noteFile, updatedContent);

                    restoredCount++;
                    details.push(`Restored ${artifactEntries.length} artifact(s): ${entry.path}`);
                    context.onProgress?.(progress, `Restored: ${noteFile.name}`);

                } catch (error) {
                    errorCount++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    details.push(`Error: ${folder.name} — ${errorMsg}`);
                }
            }

            const summary = `Restored artifacts in ${restoredCount} note(s), skipped ${skippedCount}, errors ${errorCount}.`;
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

    private extractFrontmatterField(content: string, field: string): string | null {
        const match = content.match(new RegExp(`^${field}:\\s*"?([^"\\n]+)"?`, 'm'));
        return match ? match[1].trim() : null;
    }

    private extractArtifactTitle(content: string, fallbackId: string): string {
        // Try to get title from aliases array (first element is human-readable title)
        const aliasMatch = content.match(/^aliases:\s*\[([^\]]+)\]/m);
        if (aliasMatch) {
            const firstAlias = aliasMatch[1].split(',')[0].trim();
            // Remove surrounding quotes if present
            const cleaned = firstAlias.replace(/^["']|["']$/g, '');
            if (cleaned && cleaned !== 'Untitled Artifact') {
                return cleaned;
            }
        }
        // Fallback to artifact_id
        return fallbackId;
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
                    let fixed = content.replace(/^>>(\n>>\[!nexus_)/gm, '>$1');

                    if (fixed !== content) {
                        // Also update plugin_version in frontmatter
                        fixed = updatePluginVersion(fixed, TARGET_VERSION);
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
        new RestoreMissingArtifactCalloutsOperation(),
        new FixCalloutEmptyLinesOperation()
    ];

    readonly manualOperations = [
        // No manual operations for this version
    ];
}
