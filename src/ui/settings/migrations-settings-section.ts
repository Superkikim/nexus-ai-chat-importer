// src/ui/settings/migrations-settings-section.ts
import { ButtonComponent, Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import type { IncrementalUpgradeManager } from "../../upgrade/incremental-upgrade-manager";
import { t } from "../../i18n";

type SettingsOperationData = {
    id: string;
    name: string;
    description: string;
    completed: boolean;
    canRun: boolean;
};

type SettingsVersionData = {
    version: string;
    operations: SettingsOperationData[];
};

export class MigrationsSettingsSection extends BaseSettingsSection {
    get title() {
        return t("settings.migrations.section_title");
    }
    readonly order = 30;

    async render(containerEl: HTMLElement): Promise<void> {
        const migrationsDesc = containerEl.createDiv({
            cls: "setting-item-description nexus-migrations-desc",
        });
        migrationsDesc.createEl("p").createEl("strong", {
            text: t("settings.migrations.description_manual"),
        });
        migrationsDesc.createEl("p", {
            text: t("settings.migrations.description_automatic"),
        });

        try {
            const upgradeManager = this.plugin.getUpgradeManager();
            if (!upgradeManager?.getManualOperationsForSettings) {
                this.showNoMigrationsMessage(containerEl);
                return;
            }

            // Get operation status with persistent flags
            const operationsData = await this.getOperationsWithPersistentStatus(
                upgradeManager
            );

            if (operationsData.length === 0) {
                this.showNoMigrationsMessage(containerEl);
                return;
            }

            for (const versionData of operationsData) {
                await this.renderVersionOperations(
                    containerEl,
                    versionData,
                    upgradeManager
                );
            }
        } catch (error) {
            console.error("[NEXUS-DEBUG] Error loading migrations:", error);
            this.showErrorMessage(containerEl, error);
        }
    }

    /**
     * Get operations status with persistent flags from plugin data
     */
    private async getOperationsWithPersistentStatus(
        upgradeManager: IncrementalUpgradeManager
    ): Promise<SettingsVersionData[]> {
        const operationsData: SettingsVersionData[] =
            await upgradeManager.getManualOperationsForSettings();
        const pluginData = await this.plugin.loadData();

        // Update operation status based on persistent flags in upgrade history
        for (const versionData of operationsData) {
            for (const operation of versionData.operations) {
                const operationKey = `operation_${versionData.version.replace(
                    /\./g,
                    "_"
                )}_${operation.id}`;
                const isCompleted =
                    pluginData?.upgradeHistory?.completedOperations?.[
                        operationKey
                    ]?.completed || false;

                operation.completed = isCompleted;
                operation.canRun = !isCompleted && operation.canRun;
            }
        }

        return operationsData;
    }

    private async renderVersionOperations(
        containerEl: HTMLElement,
        versionData: SettingsVersionData,
        upgradeManager: IncrementalUpgradeManager
    ): Promise<void> {
        containerEl.createEl("h3", {
            text: t("settings.migrations.version_header", {
                version: versionData.version,
            }),
            cls: "migrations-version-header nexus-migrations-version-header",
        });

        for (const operation of versionData.operations) {
            await this.renderOperation(
                containerEl,
                operation,
                versionData.version,
                upgradeManager
            );
        }
    }

    private async renderOperation(
        containerEl: HTMLElement,
        operation: SettingsOperationData,
        version: string,
        upgradeManager: IncrementalUpgradeManager
    ): Promise<void> {
        new Setting(containerEl)
            .setName(operation.name)
            .setDesc(
                operation.description +
                    (operation.completed
                        ? t("settings.migrations.operation_completed_suffix")
                        : "")
            )
            .addButton((button) => {
                if (operation.completed) {
                    button
                        .setButtonText(
                            t("settings.migrations.buttons.completed")
                        )
                        .setDisabled(true)
                        .setTooltip(
                            t("settings.migrations.tooltips.completed")
                        );
                    button.buttonEl.addClass("mod-muted");
                } else if (!operation.canRun) {
                    button
                        .setButtonText(
                            t("settings.migrations.buttons.cannot_run")
                        )
                        .setDisabled(true)
                        .setTooltip(
                            t("settings.migrations.tooltips.cannot_run")
                        );
                } else {
                    button
                        .setButtonText(t("settings.migrations.buttons.run"))
                        .setTooltip(
                            t("settings.migrations.tooltips.run", {
                                operation_name: operation.name,
                            })
                        )
                        .onClick(async () => {
                            await this.executeOperation(
                                button,
                                operation,
                                version,
                                upgradeManager
                            );
                        });
                    button.buttonEl.addClass("mod-cta");
                }
            });
    }

    private async executeOperation(
        buttonEl: ButtonComponent,
        operation: SettingsOperationData,
        version: string,
        upgradeManager: IncrementalUpgradeManager
    ): Promise<void> {
        const originalText = buttonEl.buttonEl.textContent;
        buttonEl
            .setButtonText(t("settings.migrations.buttons.running"))
            .setDisabled(true);

        try {
            console.debug(
                `[NEXUS-DEBUG] Executing manual operation: ${operation.id} (v${version})`
            );

            const result = await upgradeManager.executeManualOperation(
                version,
                operation.id
            );

            console.debug(`[NEXUS-DEBUG] Operation result:`, result);

            if (result.success) {
                // Update UI to show completed state
                buttonEl.setButtonText(
                    t("settings.migrations.buttons.completed")
                );
                buttonEl.setTooltip(
                    t("settings.migrations.tooltips.completed")
                );

                // Fix CSS class manipulation
                const buttonElement = buttonEl.buttonEl || buttonEl;
                if (buttonElement && buttonElement.removeClass) {
                    buttonElement.removeClass("mod-cta");
                    buttonElement.addClass("mod-muted");
                }

                // Update operation status
                operation.completed = true;
                operation.canRun = false;
            } else {
                buttonEl.setButtonText(originalText).setDisabled(false);
                this.showOperationResult(
                    buttonEl.buttonEl.closest(".setting-item"),
                    result.message,
                    "error"
                );
            }
        } catch (error) {
            console.error(`[NEXUS-DEBUG] Operation execution failed:`, error);
            buttonEl.setButtonText(originalText).setDisabled(false);
            this.showOperationResult(
                buttonEl.buttonEl.closest(".setting-item"),
                `Operation failed: ${error}`,
                "error"
            );
        }
    }

    private showOperationResult(
        settingEl: HTMLElement | null,
        message: string,
        type: "success" | "error"
    ): void {
        if (!settingEl) return;

        const existingMsg = settingEl.querySelector(".operation-result");
        if (existingMsg) existingMsg.remove();

        const resultEl = activeDocument.createElement("div");
        resultEl.className = "operation-result";
        resultEl.textContent = message;
        resultEl.style.cssText = `
            margin-top: 8px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 0.9em;
            background: ${
                type === "success"
                    ? "var(--background-modifier-success)"
                    : "var(--background-modifier-error)"
            };
            color: ${
                type === "success" ? "var(--text-success)" : "var(--text-error)"
            };
            border: 1px solid ${
                type === "success" ? "var(--text-success)" : "var(--text-error)"
            };
        `;

        settingEl.appendChild(resultEl);
        window.setTimeout(() => {
            if (resultEl.parentNode) {
                resultEl.remove();
            }
        }, 5000);
    }

    private showNoMigrationsMessage(containerEl: HTMLElement): void {
        const noMigrationsEl = containerEl.createDiv({
            cls: "setting-item-description nexus-no-migrations-box",
        });
        const noMigrationsP = noMigrationsEl.createEl("p");
        noMigrationsP.createEl("strong", {
            text: t("settings.migrations.no_migrations.title"),
        });
        noMigrationsP.createEl("br");
        noMigrationsP.appendText(t("settings.migrations.no_migrations.desc"));
    }

    private showErrorMessage(containerEl: HTMLElement, error: unknown): void {
        const errorEl = containerEl.createDiv({
            cls: "setting-item-description nexus-error-message-box",
        });
        const errorP = errorEl.createEl("p");
        errorP.createEl("strong", {
            text: t("settings.migrations.error_loading"),
        });
        errorP.createEl("br");
        errorP.appendText(
            error instanceof Error ? error.message : String(error)
        );
    }
}
