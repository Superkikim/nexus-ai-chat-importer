/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// src/dialogs/custom-id-property-dialogs.ts
import { App, Modal, TFile } from "obsidian";
import { t } from "../i18n";
import type { Logger } from "../logger";
import type {
    CustomIdPropertyOperation,
    CustomIdPropertyService,
    CustomIdPropertySummary,
} from "../services/custom-id-property-service";
import { UpgradeProgressModal } from "../upgrade/utils/progress-modal";
import type {
    ClearChoice,
    CustomIdPropertyUi,
} from "../ui/settings/custom-id-property-controller";

/** Failures listed in the summary; the rest go to the console. */
const LISTED_FAILURES = 10;

interface ChoiceButton<T> {
    label: string;
    value: T;
    cta?: boolean;
    hint?: string;
}

/**
 * A modal of plain text and buttons. Text is set with `text`, never parsed:
 * note paths and property names are shown as they are.
 */
class ChoiceModal<T> extends Modal {
    private settled = false;

    constructor(
        app: App,
        private heading: string,
        private paragraphs: string[],
        private buttons: ChoiceButton<T>[],
        private onDismiss: T,
        private resolve: (value: T) => void,
        private stacked = false,
        private footnote?: string,
        private list?: string[]
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("nexus-ai-chat-importer-modal");
        this.titleEl.setText(this.heading);

        for (const paragraph of this.paragraphs) {
            contentEl.createEl("p", { text: paragraph });
        }
        if (this.list && this.list.length > 0) {
            const ul = contentEl.createEl("ul", {
                cls: "nexus-custom-id-failures",
            });
            for (const item of this.list) {
                ul.createEl("li", { text: item });
            }
        }

        const container = contentEl.createDiv({
            cls: this.stacked
                ? "modal-button-container nexus-custom-id-choices"
                : "modal-button-container",
        });
        for (const button of this.buttons) {
            const el = container.createEl("button", {
                text: button.hint
                    ? `${button.label} ${button.hint}`
                    : button.label,
                cls: button.cta ? "mod-cta" : undefined,
            });
            el.addEventListener("click", () => this.finish(button.value));
        }

        if (this.footnote) {
            contentEl.createEl("p", {
                text: this.footnote,
                cls: "nexus-custom-id-footnote",
            });
        }
    }

    private finish(value: T): void {
        if (!this.settled) {
            this.settled = true;
            this.resolve(value);
        }
        this.close();
    }

    onClose(): void {
        // Escape, the close button or a click outside: the dismiss value.
        if (!this.settled) {
            this.settled = true;
            this.resolve(this.onDismiss);
        }
        this.contentEl.empty();
    }
}

function ask<T>(
    app: App,
    heading: string,
    paragraphs: string[],
    buttons: ChoiceButton<T>[],
    onDismiss: T,
    options: { stacked?: boolean; footnote?: string; list?: string[] } = {}
): Promise<T> {
    return new Promise((resolve) => {
        new ChoiceModal(
            app,
            heading,
            paragraphs,
            buttons,
            onDismiss,
            resolve,
            options.stacked,
            options.footnote,
            options.list
        ).open();
    });
}

function summaryLines(summary: CustomIdPropertySummary): string[] {
    const counts: Array<[keyof CustomIdPropertySummary, number]> = [
        ["added", summary.added],
        ["renamed", summary.renamed],
        ["overwritten", summary.overwritten],
        ["removed", summary.removed],
        ["skipped", summary.skipped],
        ["failed", summary.failed],
    ];
    return counts
        .filter(([, count]) => count > 0)
        .map(([key, count]) =>
            t(`settings.properties.summary.${key}`, {
                count: count.toLocaleString(),
            })
        );
}

function progressTitle(operation: CustomIdPropertyOperation): string {
    switch (operation.kind) {
        case "add":
            return t("settings.properties.progress.add", {
                name: operation.name,
            });
        case "rename":
            return t("settings.properties.progress.rename", {
                oldName: operation.from,
                newName: operation.to,
            });
        case "remove":
            return t("settings.properties.progress.remove", {
                name: operation.name,
            });
    }
}

/** The dialogs of the custom ID property setting. */
export class CustomIdPropertyDialogs implements CustomIdPropertyUi {
    constructor(
        private app: App,
        private service: CustomIdPropertyService,
        private logger: Logger
    ) {}

    confirmEnable(
        name: string,
        total: number,
        existing: number,
        overwrite: boolean
    ): Promise<boolean> {
        const paragraphs = [
            t("settings.properties.enable.body", {
                name,
                count: total.toLocaleString(),
            }),
        ];
        if (existing > 0) {
            paragraphs.push(
                t(
                    overwrite
                        ? "settings.properties.enable.existing_overwrite"
                        : "settings.properties.enable.existing_keep",
                    { name, existing: existing.toLocaleString() }
                )
            );
        }
        return ask(
            this.app,
            t("settings.properties.enable.title", { name }),
            paragraphs,
            [
                { label: t("common.buttons.cancel"), value: false },
                {
                    label: t("settings.properties.enable.confirm"),
                    value: true,
                    cta: true,
                },
            ],
            false
        );
    }

    confirmRename(oldName: string, newName: string): Promise<boolean> {
        return ask(
            this.app,
            t("settings.properties.rename.title", { oldName, newName }),
            [t("settings.properties.rename.body")],
            [
                { label: t("common.buttons.cancel"), value: false },
                {
                    label: t("settings.properties.rename.confirm"),
                    value: true,
                    cta: true,
                },
            ],
            false
        );
    }

    chooseClear(name: string): Promise<ClearChoice> {
        return ask<ClearChoice>(
            this.app,
            t("settings.properties.clear.title", { name }),
            [
                t("settings.properties.clear.body_stop", { name }),
                t("settings.properties.clear.body_scope"),
            ],
            [
                {
                    label: t("settings.properties.clear.remove_plugin"),
                    hint: t("settings.properties.clear.recommended"),
                    value: "remove_plugin",
                    cta: true,
                },
                {
                    label: t("settings.properties.clear.remove_all"),
                    value: "remove_all",
                },
                {
                    label: t("settings.properties.clear.keep"),
                    value: "keep",
                },
            ],
            "cancel",
            {
                stacked: true,
                footnote: t("settings.properties.clear.note"),
            }
        );
    }

    async run(
        operation: CustomIdPropertyOperation,
        files: TFile[]
    ): Promise<void> {
        const progress = new UpgradeProgressModal(
            this.app,
            progressTitle(operation),
            files.length
        );
        progress.open();

        let summary: CustomIdPropertySummary;
        try {
            summary = await this.service.run(
                files,
                operation,
                (done, _total, path) =>
                    progress.updateStep(done, { title: path })
            );
        } finally {
            progress.close();
        }

        if (summary.failures.length > 0) {
            this.logger.warn("Custom ID property: notes not updated", {
                operation,
                failures: summary.failures,
            });
        }

        const listed = summary.failures
            .slice(0, LISTED_FAILURES)
            .map(
                (failure) =>
                    `${failure.path}: ${t(
                        `settings.properties.summary.reasons.${
                            failure.reason ?? "other"
                        }`
                    )}`
            );
        const paragraphs = summaryLines(summary);
        if (listed.length > 0) {
            paragraphs.push(t("settings.properties.summary.failures"));
        }
        const hidden = summary.failures.length - listed.length;

        await ask(
            this.app,
            t("settings.properties.summary.title"),
            paragraphs,
            [{ label: t("common.buttons.ok"), value: true, cta: true }],
            true,
            {
                list: listed,
                footnote:
                    hidden > 0
                        ? t("settings.properties.summary.more_failures", {
                              count: hidden.toLocaleString(),
                          })
                        : undefined,
            }
        );
    }
}
