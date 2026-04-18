import { describe, expect, it, vi } from "vitest";
import { SettingMigrationEngine } from "./setting-migration-engine";
import type {
    SettingMigrationExecutionContext,
    SettingMigrationPlan,
    SettingMigrationResult,
    SettingMigrationWorkflow,
    SettingMigrationWorkflowContext,
} from "./setting-migration-types";
import type { PluginSettings } from "../types/plugin";

function createSettings(order: "provider-year-month" | "year-month-provider"): PluginSettings {
    return {
        conversationFolder: "Nexus/Conversations",
        reportFolder: "Nexus/Reports",
        attachmentFolder: "Nexus/Attachments",
        conversationHierarchyOrder: order,
        addDatePrefix: false,
        dateFormat: "YYYY-MM-DD",
        useCustomMessageTimestampFormat: false,
        messageTimestampFormat: "locale",
        lastConversationsPerPage: 50,
        hasShownUpgradeNotice: false,
        hasSeenClaude132UpgradeNotice: false,
        hasCompletedUpgrade: false,
        currentVersion: "1.6.0",
        previousVersion: "1.5.7",
    };
}

describe("SettingMigrationEngine", () => {
    it("should return null when no workflow is registered", async () => {
        const engine = new SettingMigrationEngine();
        const oldSettings = createSettings("provider-year-month");
        const newSettings = createSettings("year-month-provider");

        const plan = await engine.createPlan("conversationHierarchyOrder", {
            oldSettings,
            newSettings,
        });
        expect(plan).toBeNull();
    });

    it("should dispatch to registered workflow", async () => {
        const engine = new SettingMigrationEngine();
        const oldSettings = createSettings("provider-year-month");
        const newSettings = createSettings("year-month-provider");
        const context: SettingMigrationWorkflowContext = { oldSettings, newSettings };

        const plan: SettingMigrationPlan = {
            workflowId: "test",
            settingKey: "conversationHierarchyOrder",
            operationCount: 1,
            operations: [{ fromPath: "a.md", toPath: "b.md" }],
            estimatedSeconds: 2,
        };
        const result: SettingMigrationResult = {
            workflowId: "test",
            moved: 1,
            skipped: 0,
            errors: 0,
            durationMs: 10,
            details: [],
        };

        const workflow: SettingMigrationWorkflow = {
            id: "test",
            settingKey: "conversationHierarchyOrder",
            isApplicable: vi.fn().mockReturnValue(true),
            createPlan: vi.fn().mockResolvedValue(plan),
            execute: vi.fn().mockResolvedValue(result),
        };

        engine.register(workflow);

        const createdPlan = await engine.createPlan("conversationHierarchyOrder", context);
        expect(createdPlan).toEqual(plan);

        const executionContext: SettingMigrationExecutionContext = { ...context };
        const executedResult = await engine.execute(
            "conversationHierarchyOrder",
            plan,
            executionContext
        );
        expect(executedResult).toEqual(result);
    });
});
