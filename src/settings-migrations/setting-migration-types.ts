import type { PluginSettings } from "../types/plugin";

export interface SettingMigrationOperation {
    fromPath: string;
    toPath: string;
}

export interface SettingMigrationPlan {
    workflowId: string;
    settingKey: keyof PluginSettings;
    operationCount: number;
    operations: SettingMigrationOperation[];
    estimatedSeconds: number;
}

export interface SettingMigrationProgress {
    current: number;
    total: number;
    detail: string;
}

export interface SettingMigrationResult {
    workflowId: string;
    moved: number;
    skipped: number;
    errors: number;
    durationMs: number;
    details: string[];
}

export interface SettingMigrationWorkflowContext {
    oldSettings: PluginSettings;
    newSettings: PluginSettings;
}

export interface SettingMigrationExecutionContext extends SettingMigrationWorkflowContext {
    onProgress?: (progress: SettingMigrationProgress) => void;
}

export interface SettingMigrationWorkflow {
    id: string;
    settingKey: keyof PluginSettings;
    isApplicable(context: SettingMigrationWorkflowContext): boolean;
    createPlan(context: SettingMigrationWorkflowContext): Promise<SettingMigrationPlan>;
    execute(
        plan: SettingMigrationPlan,
        context: SettingMigrationExecutionContext
    ): Promise<SettingMigrationResult>;
}
