import type { PluginSettings } from "../types/plugin";
import type {
    SettingMigrationExecutionContext,
    SettingMigrationPlan,
    SettingMigrationResult,
    SettingMigrationWorkflow,
    SettingMigrationWorkflowContext,
} from "./setting-migration-types";

export class SettingMigrationEngine {
    private workflows = new Map<keyof PluginSettings, SettingMigrationWorkflow>();

    register(workflow: SettingMigrationWorkflow): void {
        this.workflows.set(workflow.settingKey, workflow);
    }

    getWorkflow(settingKey: keyof PluginSettings): SettingMigrationWorkflow | undefined {
        return this.workflows.get(settingKey);
    }

    async createPlan(
        settingKey: keyof PluginSettings,
        context: SettingMigrationWorkflowContext
    ): Promise<SettingMigrationPlan | null> {
        const workflow = this.workflows.get(settingKey);
        if (!workflow || !workflow.isApplicable(context)) {
            return null;
        }
        return workflow.createPlan(context);
    }

    async execute(
        settingKey: keyof PluginSettings,
        plan: SettingMigrationPlan,
        context: SettingMigrationExecutionContext
    ): Promise<SettingMigrationResult | null> {
        const workflow = this.workflows.get(settingKey);
        if (!workflow || !workflow.isApplicable(context)) {
            return null;
        }
        return workflow.execute(plan, context);
    }
}
