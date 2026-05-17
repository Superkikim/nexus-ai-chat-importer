// src/ui/settings/attachment-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import { t } from "../../i18n";

export class AttachmentSettingsSection extends BaseSettingsSection {
    get title() {
        return t("settings.attachments.section_title");
    }
    readonly order = 20;

    render(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName(t("settings.attachments.import_attachments.name"))
            .setDesc(t("settings.attachments.import_attachments.desc"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.importAttachments ?? true)
                    .onChange(async (value) => {
                        this.plugin.settings.importAttachments = value;
                        await this.plugin.saveSettings();
                        this.redraw(); // Trigger redraw to show/hide attachment options
                    })
            );

        if (this.plugin.settings.importAttachments ?? true) {
            this.renderAttachmentOptions(containerEl);
            this.renderAttachmentInfo(containerEl);
        }
    }

    private renderAttachmentOptions(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName(t("settings.folders.attachment_folder.name"))
            .setDesc(t("settings.folders.attachment_folder.desc"))
            .addText((text) =>
                text
                    .setPlaceholder(
                        t("settings.folders.attachment_folder.placeholder")
                    )
                    .setValue(this.plugin.settings.attachmentFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.attachmentFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.attachments.handle_missing.name"))
            .setDesc(t("settings.attachments.handle_missing.desc"))
            .addToggle((toggle) =>
                toggle
                    .setValue(!this.plugin.settings.skipMissingAttachments)
                    .onChange(async (value) => {
                        this.plugin.settings.skipMissingAttachments = !value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.attachments.show_details.name"))
            .setDesc(t("settings.attachments.show_details.desc"))
            .addToggle((toggle) =>
                toggle
                    .setValue(
                        this.plugin.settings.showAttachmentDetails ?? false
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.showAttachmentDetails = value;
                        await this.plugin.saveSettings();
                    })
            );
    }

    private renderAttachmentInfo(containerEl: HTMLElement): void {
        const noteEl = containerEl.createDiv({
            cls: "setting-item-description nexus-settings-info-box",
        });

        noteEl.createEl("h4", {
            text: t("settings.attachments.info_box.title"),
            cls: "setting-item-name",
        });

        const infoList = noteEl.createEl("ul");
        infoList.addClass("nexus-settings-info-list");

        infoList.createEl("li", {
            text: t("settings.attachments.info_box.best_effort"),
        });
        infoList.createEl("li", {
            text: t("settings.attachments.info_box.platform_diff"),
        });
        infoList.createEl("li", {
            text: t("settings.attachments.info_box.organization"),
        });
        infoList.createEl("li", {
            text: t("settings.attachments.info_box.sync_tip"),
        });

        const tipEl = noteEl.createDiv();
        tipEl.addClass("nexus-settings-info-tip");
        tipEl.textContent = t("settings.attachments.info_box.tip");
    }
}
