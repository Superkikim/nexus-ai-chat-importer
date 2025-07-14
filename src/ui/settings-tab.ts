// src/ui/settings-tab.ts
import { App, PluginSettingTab } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { BaseSettingsSection } from "./settings/base-settings-section";
import { ConversationSettingsSection } from "./settings/conversation-settings-section";
import { AttachmentSettingsSection } from "./settings/attachment-settings-section";
import { MigrationsSettingsSection } from "./settings/migrations-settings-section";

export class NexusAiChatImporterPluginSettingTab extends PluginSettingTab {
    private sections: BaseSettingsSection[] = [];

    constructor(app: App, private plugin: NexusAiChatImporterPlugin) {
        super(app, plugin);
        this.initializeSections();
    }

    private initializeSections(): void {
        this.sections = [
            new ConversationSettingsSection(this.plugin),
            new AttachmentSettingsSection(this.plugin),
            new MigrationsSettingsSection(this.plugin)
        ].sort((a, b) => a.order - b.order);

        // Set redraw callback for each section
        this.sections.forEach(section => {
            section.setRedrawCallback(() => this.display());
        });
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.renderSections(containerEl);
    }

    private async renderSections(containerEl: HTMLElement): Promise<void> {
        for (const section of this.sections) {
            if (section.title) {
                containerEl.createEl("h2", { text: section.title });
            }
            
            await section.render(containerEl);
        }
    }
}