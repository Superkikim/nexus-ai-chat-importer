// src/ui/settings/migrations-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import { t } from '../../i18n';

export class MigrationsSettingsSection extends BaseSettingsSection {
    get title() { return t('settings.migrations.section_title'); }
    readonly order = 30;

    async render(containerEl: HTMLElement): Promise<void> {
        const migrationsDesc = containerEl.createDiv({ cls: "setting-item-description" });
        migrationsDesc.style.marginBottom = "20px";
        migrationsDesc.innerHTML = `
            <p><strong>${t('settings.migrations.description_manual')}</strong></p>
            <p>${t('settings.migrations.description_automatic')}</p>
        `;

        try {
            const upgradeManager = this.plugin.getUpgradeManager();
            if (!upgradeManager?.getManualOperationsForSettings) {
                this.showNoMigrationsMessage(containerEl);
                return;
            }

            // Get operation status with persistent flags
            const operationsData = await this.getOperationsWithPersistentStatus(upgradeManager);
            
            if (operationsData.length === 0) {
                this.showNoMigrationsMessage(containerEl);
                return;
            }

            for (const versionData of operationsData) {
                await this.renderVersionOperations(containerEl, versionData, upgradeManager);
            }

        } catch (error) {
            console.error("[NEXUS-DEBUG] Error loading migrations:", error);
            this.showErrorMessage(containerEl, error);
        }
    }

    /**
     * Get operations status with persistent flags from plugin data
     */
    private async getOperationsWithPersistentStatus(upgradeManager: any): Promise<any[]> {
        const operationsData = await upgradeManager.getManualOperationsForSettings();
        const pluginData = await this.plugin.loadData();
        
        // Update operation status based on persistent flags in upgrade history
        for (const versionData of operationsData) {
            for (const operation of versionData.operations) {
                const operationKey = `operation_${versionData.version.replace(/\./g, '_')}_${operation.id}`;
                const isCompleted = pluginData?.upgradeHistory?.completedOperations?.[operationKey]?.completed || false;
                
                operation.completed = isCompleted;
                operation.canRun = !isCompleted && operation.canRun;
            }
        }
        
        return operationsData;
    }

    private async renderVersionOperations(
        containerEl: HTMLElement,
        versionData: any,
        upgradeManager: any
    ): Promise<void> {
        const versionHeader = containerEl.createEl("h3", {
            text: t('settings.migrations.version_header', { version: versionData.version }),
            cls: "migrations-version-header"
        });
        versionHeader.style.marginTop = "25px";
        versionHeader.style.marginBottom = "15px";
        versionHeader.style.color = "var(--text-accent)";

        for (const operation of versionData.operations) {
            await this.renderOperation(containerEl, operation, versionData.version, upgradeManager);
        }
    }

    private async renderOperation(
        containerEl: HTMLElement,
        operation: any,
        version: string,
        upgradeManager: any
    ): Promise<void> {
        new Setting(containerEl)
            .setName(operation.name)
            .setDesc(operation.description + (operation.completed ? t('settings.migrations.operation_completed_suffix') : ""))
            .addButton(button => {
                if (operation.completed) {
                    button
                        .setButtonText(t('settings.migrations.buttons.completed'))
                        .setDisabled(true)
                        .setTooltip(t('settings.migrations.tooltips.completed'));
                    button.buttonEl.addClass("mod-muted");
                } else if (!operation.canRun) {
                    button
                        .setButtonText(t('settings.migrations.buttons.cannot_run'))
                        .setDisabled(true)
                        .setTooltip(t('settings.migrations.tooltips.cannot_run'));
                } else {
                    button
                        .setButtonText(t('settings.migrations.buttons.run'))
                        .setTooltip(t('settings.migrations.tooltips.run', { operation_name: operation.name }))
                        .onClick(async () => {
                            await this.executeOperation(button, operation, version, upgradeManager);
                        });
                    button.buttonEl.addClass("mod-cta");
                }
            });
    }

    private async executeOperation(
        buttonEl: any, 
        operation: any, 
        version: string, 
        upgradeManager: any
    ): Promise<void> {
        const originalText = buttonEl.buttonEl.textContent;
        buttonEl.setButtonText(t('settings.migrations.buttons.running')).setDisabled(true);

        try {
            console.debug(`[NEXUS-DEBUG] Executing manual operation: ${operation.id} (v${version})`);
            
            const result = await upgradeManager.executeManualOperation(version, operation.id);
            
            console.debug(`[NEXUS-DEBUG] Operation result:`, result);

            if (result.success) {
                // Update UI to show completed state
                buttonEl.setButtonText(t('settings.migrations.buttons.completed'));
                buttonEl.setTooltip(t('settings.migrations.tooltips.completed'));
                
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
                    buttonEl.buttonEl.closest('.setting-item'), 
                    result.message, 
                    'error'
                );
            }
        } catch (error) {
            console.error(`[NEXUS-DEBUG] Operation execution failed:`, error);
            buttonEl.setButtonText(originalText).setDisabled(false);
            this.showOperationResult(
                buttonEl.buttonEl.closest('.setting-item'), 
                `Operation failed: ${error}`, 
                'error'
            );
        }
    }

    private showOperationResult(
        settingEl: HTMLElement | null, 
        message: string, 
        type: 'success' | 'error'
    ): void {
        if (!settingEl) return;

        const existingMsg = settingEl.querySelector('.operation-result');
        if (existingMsg) existingMsg.remove();

        const resultEl = document.createElement('div');
        resultEl.className = 'operation-result';
        resultEl.textContent = message;
        resultEl.style.cssText = `
            margin-top: 8px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 0.9em;
            background: ${type === 'success' ? 'var(--background-modifier-success)' : 'var(--background-modifier-error)'};
            color: ${type === 'success' ? 'var(--text-success)' : 'var(--text-error)'};
            border: 1px solid ${type === 'success' ? 'var(--text-success)' : 'var(--text-error)'};
        `;

        settingEl.appendChild(resultEl);
        setTimeout(() => {
            if (resultEl.parentNode) {
                resultEl.remove();
            }
        }, 5000);
    }

    private showNoMigrationsMessage(containerEl: HTMLElement): void {
        const noMigrationsEl = containerEl.createDiv({ cls: "setting-item-description" });
        noMigrationsEl.style.marginTop = "15px";
        noMigrationsEl.style.padding = "15px";
        noMigrationsEl.style.backgroundColor = "var(--background-secondary)";
        noMigrationsEl.style.borderRadius = "8px";
        noMigrationsEl.style.textAlign = "center";
        noMigrationsEl.innerHTML = `
            <p style="margin: 0; color: var(--text-muted);">
                <strong>${t('settings.migrations.no_migrations.title')}</strong><br>
                ${t('settings.migrations.no_migrations.desc')}
            </p>
        `;
    }

    private showErrorMessage(containerEl: HTMLElement, error: any): void {
        const errorEl = containerEl.createDiv({ cls: "setting-item-description" });
        errorEl.style.marginTop = "15px";
        errorEl.style.padding = "15px";
        errorEl.style.backgroundColor = "var(--background-modifier-error)";
        errorEl.style.color = "var(--text-error)";
        errorEl.style.borderRadius = "8px";
        errorEl.innerHTML = `
            <p style="margin: 0;">
                <strong>${t('settings.migrations.error_loading')}</strong><br>
                ${error.message || error}
            </p>
        `;
    }
}