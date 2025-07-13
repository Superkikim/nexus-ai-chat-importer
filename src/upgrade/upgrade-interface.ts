// src/upgrade/upgrade-interface.ts
import type NexusAiChatImporterPlugin from "../main";
import { VersionUtils } from "./utils/version-utils";
import { showDialog } from "../dialogs";
import { Logger } from "../logger";

const logger = new Logger();

export interface OperationResult {
    success: boolean;
    message: string;
    details?: any;
}

export interface UpgradeContext {
    plugin: NexusAiChatImporterPlugin;
    fromVersion: string;
    toVersion: string;
    pluginData: any;
}

export abstract class UpgradeOperation {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly type: 'automatic' | 'manual';

    /**
     * Check if operation can run (prerequisites)
     */
    async canRun(context: UpgradeContext): Promise<boolean> {
        return true;
    }

    /**
     * Execute the operation
     */
    abstract execute(context: UpgradeContext): Promise<OperationResult>;

    /**
     * Verify operation completed successfully
     */
    async verify(context: UpgradeContext): Promise<boolean> {
        return true;
    }
}

export abstract class VersionUpgrade {
    abstract readonly version: string;
    abstract readonly automaticOperations: UpgradeOperation[];
    abstract readonly manualOperations: UpgradeOperation[];

    /**
     * Check if this upgrade should run for the version range
     */
    shouldRun(fromVersion: string, toVersion: string): boolean {
        // Run if target version >= this upgrade version and user is upgrading to/past it
        return VersionUtils.compareVersions(toVersion, this.version) >= 0 &&
               VersionUtils.compareVersions(fromVersion, this.version) < 0;
    }

    /**
     * Execute all automatic operations
     */
    async executeAutomaticOperations(context: UpgradeContext): Promise<{
        success: boolean;
        results: Array<{operationId: string; result: OperationResult}>;
    }> {
        const results: Array<{operationId: string; result: OperationResult}> = [];
        let allSuccess = true;

        for (const operation of this.automaticOperations) {
            try {
                // Check if already completed
                if (await this.isOperationCompleted(operation.id, context)) {
                    results.push({
                        operationId: operation.id,
                        result: { success: true, message: "Already completed" }
                    });
                    continue;
                }

                // Check if can run
                if (!(await operation.canRun(context))) {
                    results.push({
                        operationId: operation.id,
                        result: { success: false, message: "Prerequisites not met" }
                    });
                    allSuccess = false;
                    continue;
                }

                // Execute operation
                const result = await operation.execute(context);
                results.push({ operationId: operation.id, result });

                if (result.success) {
                    await this.markOperationCompleted(operation.id, context);
                } else {
                    allSuccess = false;
                }

            } catch (error) {
                const errorResult = {
                    success: false,
                    message: `Operation failed: ${error}`,
                    details: { error: String(error) }
                };
                results.push({ operationId: operation.id, result: errorResult });
                allSuccess = false;
            }
        }

        return { success: allSuccess, results };
    }

    /**
     * Show manual operations dialog and execute selected ones
     */
    async showManualOperationsDialog(context: UpgradeContext): Promise<{
        success: boolean;
        results: Array<{operationId: string; result: OperationResult}>;
    }> {
        // Filter operations that can run and aren't completed
        const availableOperations = [];
        for (const operation of this.manualOperations) {
            if (!(await this.isOperationCompleted(operation.id, context)) &&
                await operation.canRun(context)) {
                availableOperations.push(operation);
            }
        }

        if (availableOperations.length === 0) {
            return { success: true, results: [] };
        }

        // Build dialog content
        const paragraphs = [
            `**Version ${this.version} Manual Operations**`,
            "The following optional operations are available:",
            "",
            ...availableOperations.map(op => `• **${op.name}**: ${op.description}`)
        ];

        const shouldExecute = await showDialog(
            context.plugin.app,
            "confirmation",
            `Optional Operations - v${this.version}`,
            paragraphs,
            "These operations are optional and can be run later from Settings → Migrations",
            { button1: "Run All Now", button2: "Skip (Run Later)" }
        );

        const results: Array<{operationId: string; result: OperationResult}> = [];

        if (shouldExecute) {
            // Execute all available manual operations
            for (const operation of availableOperations) {
                try {
                    const result = await operation.execute(context);
                    results.push({ operationId: operation.id, result });

                    if (result.success) {
                        await this.markOperationCompleted(operation.id, context);
                    }
                } catch (error) {
                    const errorResult = {
                        success: false,
                        message: `Operation failed: ${error}`,
                        details: { error: String(error) }
                    };
                    results.push({ operationId: operation.id, result: errorResult });
                }
            }
        }

        return { 
            success: results.every(r => r.result.success), 
            results 
        };
    }

    /**
     * Get manual operations status for settings UI
     */
    async getManualOperationsStatus(context: UpgradeContext): Promise<Array<{
        operation: UpgradeOperation;
        completed: boolean;
        canRun: boolean;
    }>> {
        const status = [];
        
        for (const operation of this.manualOperations) {
            const completed = await this.isOperationCompleted(operation.id, context);
            const canRun = !completed && await operation.canRun(context);
            
            status.push({
                operation,
                completed,
                canRun
            });
        }
        
        return status;
    }

    /**
     * Execute single manual operation (from settings)
     */
    async executeManualOperation(operationId: string, context: UpgradeContext): Promise<OperationResult> {
        const operation = this.manualOperations.find(op => op.id === operationId);
        if (!operation) {
            return { success: false, message: "Operation not found" };
        }

        if (await this.isOperationCompleted(operation.id, context)) {
            return { success: true, message: "Already completed" };
        }

        if (!(await operation.canRun(context))) {
            return { success: false, message: "Prerequisites not met" };
        }

        try {
            const result = await operation.execute(context);
            if (result.success) {
                await this.markOperationCompleted(operation.id, context);
            }
            return result;
        } catch (error) {
            return {
                success: false,
                message: `Operation failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    /**
     * Check if operation was completed
     */
    private async isOperationCompleted(operationId: string, context: UpgradeContext): Promise<boolean> {
        const data = await context.plugin.loadData();
        const flagKey = `operation_${this.version.replace(/\./g, '_')}_${operationId}`;
        return !!data[flagKey];
    }

    /**
     * Mark operation as completed
     */
    private async markOperationCompleted(operationId: string, context: UpgradeContext): Promise<void> {
        const data = await context.plugin.loadData() || {};
        const flagKey = `operation_${this.version.replace(/\./g, '_')}_${operationId}`;
        
        data[flagKey] = true;
        data[`${flagKey}_date`] = new Date().toISOString();
        
        await context.plugin.saveData(data);
        
        logger.info(`Marked operation ${operationId} (v${this.version}) as completed`);
    }
}