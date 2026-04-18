import { App, Modal } from "obsidian";
import { t } from "../i18n";

export type SettingMigrationDecision = "migrate" | "apply-only" | "cancel";

export class SettingMigrationDecisionDialog extends Modal {
    constructor(
        app: App,
        private settingLabel: string,
        private impactedCount: number,
        private onDecision: (decision: SettingMigrationDecision) => Promise<void>
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: t("settings_migration.decision.title") });
        contentEl.createEl("p", {
            text: t("settings_migration.decision.description", {
                setting: this.settingLabel,
                count: String(this.impactedCount),
            }),
        });

        const buttonRow = contentEl.createDiv({ cls: "modal-button-container" });

        const cancelButton = buttonRow.createEl("button", {
            text: t("common.buttons.cancel"),
        });
        cancelButton.addEventListener("click", async () => {
            this.close();
            await this.onDecision("cancel");
        });

        const applyOnlyButton = buttonRow.createEl("button", {
            text: t("settings_migration.decision.apply_only"),
        });
        applyOnlyButton.addEventListener("click", async () => {
            this.close();
            await this.onDecision("apply-only");
        });

        const migrateButton = buttonRow.createEl("button", {
            text: t("settings_migration.decision.apply_and_migrate"),
            cls: "mod-cta",
        });
        migrateButton.addEventListener("click", async () => {
            this.close();
            await this.onDecision("migrate");
        });
    }
}
