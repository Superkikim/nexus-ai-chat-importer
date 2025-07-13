// src/upgrade/migrations/migration-interface.ts
import type NexusAiChatImporterPlugin from "../../main";

export interface MigrationResult {
    success: boolean;
    message: string;
    details?: any;
    stats?: {
        processed: number;
        successful: number;
        failed: number;
        skipped: number;
    };
}

export interface MigrationContext {
    plugin: NexusAiChatImporterPlugin;
    fromVersion: string;
    toVersion: string;
    pluginData: any;
}

export abstract class BaseMigration {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly fromVersion: string; // Minimum version that needs this migration
    abstract readonly toVersion: string;   // Version this migration targets

    /**
     * Check if this migration should run for the given version range
     */
    abstract shouldRun(fromVersion: string, toVersion: string): boolean;

    /**
     * Check if migration can run (prerequisites met)
     */
    async canRun(context: MigrationContext): Promise<boolean> {
        return true; // Default: always can run
    }

    /**
     * Show confirmation dialog to user (optional)
     */
    async requestUserConfirmation(context: MigrationContext): Promise<boolean> {
        return true; // Default: no confirmation needed
    }

    /**
     * Execute the migration
     */
    abstract execute(context: MigrationContext): Promise<MigrationResult>;

    /**
     * Verify migration completed successfully (optional)
     */
    async verify(context: MigrationContext): Promise<boolean> {
        return true; // Default: assume success
    }
}