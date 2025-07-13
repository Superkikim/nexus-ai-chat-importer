// src/ui/settings-tab-integration.ts
import { Setting } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

/**
 * Add migrations section to existing settings tab
 */
export async function addMigrationsToSettingsTab(
    containerEl: HTMLElement, 
    plugin: NexusAiChatImporterPlugin
): Promise<void> {
    
    // Migrations section header
    containerEl.createEl("h2", { text: "Migrations" });
    
    const migrationsDesc = containerEl.createDiv({ cls: "setting-item-description" });
    migrationsDesc.style.marginBottom = "20px";
    migrationsDesc.innerHTML = `
        <p><strong>Manual Operations:</strong> Optional upgrade operations that can be run when convenient.</p>
        <p>Automatic operations (like removing old data) run automatically during upgrade and are not shown here.</p>
    `;

    try {
        // Get upgrade manager from plugin
        const upgradeManager = plugin.getUpgradeManager();
        if (!upgradeManager?.getManualOperationsForSettings) {
            showNoMigrationsMessage(containerEl);
            return;
        }

        // Get manual operations status
        const operationsData = await upgradeManager.getManualOperationsForSettings();
        
        if (operationsData.length === 0) {
            showNoMigrationsMessage(containerEl);
            return;
        }

        // Render operations by version
        for (const versionData of operationsData) {
            await renderVersionOperations(containerEl, versionData, plugin, upgradeManager);
        }

    } catch (error) {
        console.error("[NEXUS-DEBUG] Error loading migrations:", error);
        showErrorMessage(containerEl, error);
    }
}

/**
 * Render operations for a specific version
 */
async function renderVersionOperations(
    containerEl: HTMLElement,
    versionData: any,
    plugin: NexusAiChatImporterPlugin,
    upgradeManager: any
): Promise<void> {
    
    // Version header
    const versionHeader = containerEl.createEl("h3", { 
        text: `Version ${versionData.version}`,
        cls: "migrations-version-header"
    });
    versionHeader.style.marginTop = "25px";
    versionHeader.style.marginBottom = "15px";
    versionHeader.style.color = "var(--text-accent)";

    // Render each operation
    for (const operation of versionData.operations) {
        await renderOperation(containerEl, operation, versionData.version, plugin, upgradeManager);
    }
}

/**
 * Render single operation setting
 */
async function renderOperation(
    containerEl: HTMLElement,
    operation: any,
    version: string,
    plugin: NexusAiChatImporterPlugin,
    upgradeManager: any
): Promise<void> {
    
    new Setting(containerEl)
        .setName(operation.name)
        .setDesc(operation.description + (operation.completed ? " ✅ Completed" : ""))
        .addButton(button => {
            if (operation.completed) {
                button
                    .setButtonText("Completed")
                    .setDisabled(true)
                    .setTooltip("This operation has already been completed");
            } else if (!operation.canRun) {
                button
                    .setButtonText("Cannot Run")
                    .setDisabled(true)
                    .setTooltip("Prerequisites not met for this operation");
            } else {
                button
                    .setButtonText("Run")
                    .setTooltip(`Execute ${operation.name}`)
                    .onClick(async () => {
                        await executeOperation(button, operation, version, plugin, upgradeManager);
                    });
            }
            
            // Style the button based on status
            if (operation.completed) {
                button.buttonEl.addClass("mod-muted");
            } else if (operation.canRun) {
                button.buttonEl.addClass("mod-cta");
            }
        });
}

/**
 * Execute operation when button clicked
 */
async function executeOperation(
    buttonEl: any,
    operation: any,
    version: string,
    plugin: NexusAiChatImporterPlugin,
    upgradeManager: any
): Promise<void> {
    
    // Update button to show progress
    const originalText = buttonEl.buttonEl.textContent;
    buttonEl.setButtonText("Running...");
    buttonEl.setDisabled(true);

    try {
        console.debug(`[NEXUS-DEBUG] Executing manual operation: ${operation.id} (v${version})`);
        
        // Execute operation
        const result = await upgradeManager.executeManualOperation(version, operation.id);
        
        console.debug(`[NEXUS-DEBUG] Operation result:`, result);

        // Update UI based on result
        if (result.success) {
            buttonEl.setButtonText("Completed");
            buttonEl.buttonEl.removeClass("mod-cta");
            buttonEl.buttonEl.addClass("mod-muted");
            
            // Show success message
            showOperationResult(
                buttonEl.buttonEl.closest('.setting-item'),
                result.message,
                'success'
            );
            
            // Update operation status
            operation.completed = true;
            operation.canRun = false;
            
        } else {
            buttonEl.setButtonText(originalText);
            buttonEl.setDisabled(false);
            
            // Show error message
            showOperationResult(
                buttonEl.buttonEl.closest('.setting-item'),
                result.message,
                'error'
            );
        }

    } catch (error) {
        console.error(`[NEXUS-DEBUG] Operation execution failed:`, error);
        
        buttonEl.setButtonText(originalText);
        buttonEl.setDisabled(false);
        
        showOperationResult(
            buttonEl.buttonEl.closest('.setting-item'),
            `Operation failed: ${error}`,
            'error'
        );
    }
}

/**
 * Show operation result message
 */
function showOperationResult(
    settingEl: HTMLElement | null,
    message: string,
    type: 'success' | 'error'
): void {
    if (!settingEl) return;

    // Remove existing result messages
    const existingMsg = settingEl.querySelector('.operation-result');
    if (existingMsg) {
        existingMsg.remove();
    }

    // Create new result message
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

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (resultEl.parentNode) {
            resultEl.remove();
        }
    }, 5000);
}

/**
 * Show message when no migrations available
 */
function showNoMigrationsMessage(containerEl: HTMLElement): void {
    const noMigrationsEl = containerEl.createDiv({ cls: "setting-item-description" });
    noMigrationsEl.style.marginTop = "15px";
    noMigrationsEl.style.padding = "15px";
    noMigrationsEl.style.backgroundColor = "var(--background-secondary)";
    noMigrationsEl.style.borderRadius = "8px";
    noMigrationsEl.style.textAlign = "center";
    noMigrationsEl.innerHTML = `
        <p style="margin: 0; color: var(--text-muted);">
            <strong>No manual operations available</strong><br>
            All upgrade operations have been completed automatically.
        </p>
    `;
}

/**
 * Show error message
 */
function showErrorMessage(containerEl: HTMLElement, error: any): void {
    const errorEl = containerEl.createDiv({ cls: "setting-item-description" });
    errorEl.style.marginTop = "15px";
    errorEl.style.padding = "15px";
    errorEl.style.backgroundColor = "var(--background-modifier-error)";
    errorEl.style.color = "var(--text-error)";
    errorEl.style.borderRadius = "8px";
    errorEl.innerHTML = `
        <p style="margin: 0;">
            <strong>Error loading migrations:</strong><br>
            ${error.message || error}
        </p>
    `;
}