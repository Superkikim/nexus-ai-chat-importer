import { TFile } from "obsidian";
import type NexusAiChatImporterPlugin from "../../main";
import { ensureFolderExists } from "../../utils";
import { buildConversationFolderPath } from "../../services/conversation-path-resolver";
import { LinkUpdateService } from "../../services/link-update-service";
import type {
    SettingMigrationExecutionContext,
    SettingMigrationPlan,
    SettingMigrationResult,
    SettingMigrationWorkflow,
    SettingMigrationWorkflowContext,
} from "../setting-migration-types";

export class ConversationHierarchyMigrationWorkflow implements SettingMigrationWorkflow {
    readonly id = "conversation-hierarchy-order";
    readonly settingKey = "conversationHierarchyOrder" as const;

    constructor(private plugin: NexusAiChatImporterPlugin) {}

    isApplicable(context: SettingMigrationWorkflowContext): boolean {
        return (
            context.oldSettings.conversationHierarchyOrder !==
            context.newSettings.conversationHierarchyOrder
        );
    }

    async createPlan(context: SettingMigrationWorkflowContext): Promise<SettingMigrationPlan> {
        const operations: Array<{ fromPath: string; toPath: string }> = [];
        const files = this.getNexusConversationFiles(context.newSettings.conversationFolder);

        for (const file of files) {
            const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            const provider = this.resolveProvider(frontmatter?.provider, file.path, context.oldSettings.conversationFolder, context.oldSettings.conversationHierarchyOrder);
            if (!provider) {
                continue;
            }

            const createTimeUnixSeconds = this.resolveCreateTime(file, frontmatter?.create_time);
            const targetFolder = buildConversationFolderPath(
                context.newSettings.conversationFolder,
                createTimeUnixSeconds,
                provider,
                context.newSettings.conversationHierarchyOrder
            );
            const toPath = `${targetFolder}/${file.name}`;

            if (toPath !== file.path) {
                operations.push({ fromPath: file.path, toPath });
            }
        }

        return {
            workflowId: this.id,
            settingKey: this.settingKey,
            operationCount: operations.length,
            operations,
            estimatedSeconds: Math.max(2, Math.ceil(operations.length * 0.06)),
        };
    }

    async execute(
        plan: SettingMigrationPlan,
        context: SettingMigrationExecutionContext
    ): Promise<SettingMigrationResult> {
        const startedAt = Date.now();
        const details: string[] = [];
        let moved = 0;
        let skipped = 0;
        let errors = 0;
        const movedPathMappings: Array<{ oldPath: string; newPath: string }> = [];

        const total = plan.operations.length;

        for (let i = 0; i < total; i++) {
            const operation = plan.operations[i];
            context.onProgress?.({
                current: i,
                total,
                detail: `Moving ${i + 1}/${total}: ${operation.fromPath}`,
            });

            try {
                const abstractFile = this.plugin.app.vault.getAbstractFileByPath(operation.fromPath);
                if (!(abstractFile instanceof TFile)) {
                    skipped++;
                    details.push(`Skipped (not found): ${operation.fromPath}`);
                    continue;
                }

                const targetExists = await this.plugin.app.vault.adapter.exists(operation.toPath);
                if (targetExists) {
                    skipped++;
                    details.push(`Skipped (target exists): ${operation.toPath}`);
                    continue;
                }

                const targetFolder = operation.toPath.slice(0, operation.toPath.lastIndexOf("/"));
                const ensureResult = await ensureFolderExists(targetFolder, this.plugin.app.vault);
                if (!ensureResult.success) {
                    errors++;
                    details.push(`Error (create folder): ${targetFolder}`);
                    continue;
                }

                // Preferred API path: Obsidian fileManager handles link updates based on user preferences.
                await this.plugin.app.fileManager.renameFile(abstractFile, operation.toPath);
                moved++;
                movedPathMappings.push({
                    oldPath: operation.fromPath,
                    newPath: operation.toPath,
                });
            } catch (error) {
                errors++;
                details.push(`Error moving ${operation.fromPath}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (movedPathMappings.length > 0) {
            try {
                const linkUpdateService = new LinkUpdateService(this.plugin);
                const fallbackStats = await linkUpdateService.updateConversationLinksBatch(
                    movedPathMappings
                );
                if (fallbackStats.conversationLinksUpdated > 0) {
                    details.push(
                        `Fallback link update: fixed ${fallbackStats.conversationLinksUpdated} links in ${fallbackStats.filesModified} files`
                    );
                }
            } catch (error) {
                details.push(
                    `Fallback link update failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        context.onProgress?.({
            current: total,
            total,
            detail: `Migration complete: moved=${moved}, skipped=${skipped}, errors=${errors}`,
        });

        return {
            workflowId: this.id,
            moved,
            skipped,
            errors,
            durationMs: Date.now() - startedAt,
            details,
        };
    }

    private getNexusConversationFiles(conversationFolder: string): TFile[] {
        const markdownFiles = this.plugin.app.vault.getMarkdownFiles();
        return markdownFiles.filter((file) => {
            if (!file.path.startsWith(`${conversationFolder}/`)) {
                return false;
            }
            const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            return (
                frontmatter?.nexus === this.plugin.manifest.id &&
                typeof frontmatter?.conversation_id === "string"
            );
        });
    }

    private resolveCreateTime(file: TFile, rawCreateTime: unknown): number {
        if (typeof rawCreateTime === "number") {
            if (rawCreateTime > 1_000_000_000_000) {
                return Math.floor(rawCreateTime / 1000);
            }
            return Math.floor(rawCreateTime);
        }

        if (typeof rawCreateTime === "string") {
            const parsed = Date.parse(rawCreateTime);
            if (!Number.isNaN(parsed)) {
                return Math.floor(parsed / 1000);
            }
        }

        return Math.floor(file.stat.ctime / 1000);
    }

    private resolveProvider(
        rawProvider: unknown,
        filePath: string,
        conversationFolder: string,
        oldOrder: "provider-year-month" | "year-month-provider"
    ): string | null {
        if (typeof rawProvider === "string" && rawProvider.trim().length > 0) {
            return rawProvider.trim();
        }

        const prefix = `${conversationFolder}/`;
        const relative = filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
        const segments = relative.split("/").filter(Boolean);
        if (segments.length < 3) {
            return null;
        }

        if (oldOrder === "provider-year-month") {
            return segments[0] || null;
        }

        return segments[2] || null;
    }
}
