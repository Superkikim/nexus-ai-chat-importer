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

/**
 * A modal that resolves once: with the value of the button clicked, or with
 * `onDismiss` when closed by Escape, the close button or a click outside.
 *
 * Built from the folder migration dialog's parts (centred title, monospace
 * name box, info and warning boxes, full-width buttons) and the import
 * completion dialog's stat cards, so it reads as the same product. All text
 * is set with `text`, never parsed: note paths are shown as they are.
 */
class CustomIdModal<T> extends Modal {
    private settled = false;

    constructor(
        app: App,
        private build: (el: HTMLElement, finish: (value: T) => void) => void,
        private onDismiss: T,
        private resolve: (value: T) => void
    ) {
        super(app);
    }

    onOpen(): void {
        this.modalEl.addClass("nexus-custom-id-dialog");
        this.build(this.contentEl, (value) => this.finish(value));
    }

    private finish(value: T): void {
        if (!this.settled) {
            this.settled = true;
            this.resolve(value);
        }
        this.close();
    }

    onClose(): void {
        if (!this.settled) {
            this.settled = true;
            this.resolve(this.onDismiss);
        }
        this.contentEl.empty();
    }
}

function open<T>(
    app: App,
    onDismiss: T,
    build: (el: HTMLElement, finish: (value: T) => void) => void
): Promise<T> {
    return new Promise((resolve) => {
        new CustomIdModal(app, build, onDismiss, resolve).open();
    });
}

function title(el: HTMLElement, text: string): void {
    el.createEl("h2", { text, cls: "nexus-migration-title" });
}

function message(el: HTMLElement, ...paragraphs: string[]): void {
    const container = el.createDiv({ cls: "nexus-migration-message" });
    for (const text of paragraphs) {
        container.createEl("p", { text });
    }
}

/** The property name(s), in the monospace box the folder move uses. */
function nameBox(el: HTMLElement, name: string, renamedTo?: string): void {
    const box = el.createDiv({ cls: "nexus-migration-paths" });
    if (renamedTo === undefined) {
        box.createDiv({ text: name, cls: "nexus-migration-path-new" });
        return;
    }
    box.createDiv({ text: name, cls: "nexus-migration-path-old" });
    box.createDiv({ text: `→ ${renamedTo}`, cls: "nexus-migration-path-new" });
}

/** Green box: reassurance. Red box: something will be replaced. */
function notice(el: HTMLElement, kind: "info" | "warning", text: string): void {
    const box = el.createDiv({
        cls:
            kind === "info"
                ? "nexus-link-update-info"
                : "nexus-migration-warning",
    });
    box.createEl("p", { text });
}

function buttons<T>(
    el: HTMLElement,
    finish: (value: T) => void,
    specs: Array<{ label: string; value: T; cta?: boolean }>,
    stacked = false
): void {
    const container = el.createDiv({
        cls: stacked
            ? "nexus-migration-buttons nexus-custom-id-choices"
            : "nexus-migration-buttons",
    });
    for (const spec of specs) {
        const button = container.createEl("button", {
            text: spec.label,
            cls: spec.cta ? "mod-cta" : "nexus-migration-button-cancel",
        });
        button.addEventListener("click", () => finish(spec.value));
    }
}

const SUMMARY_CARDS: Array<{
    key: Exclude<keyof CustomIdPropertySummary, "failures">;
    icon: string;
    color: string;
}> = [
    { key: "added", icon: "✨", color: "var(--color-green)" },
    { key: "renamed", icon: "✏️", color: "var(--color-purple)" },
    { key: "overwritten", icon: "🔄", color: "var(--color-orange)" },
    { key: "removed", icon: "🧹", color: "var(--color-blue)" },
    { key: "skipped", icon: "⏭️", color: "var(--text-muted)" },
    { key: "failed", icon: "❌", color: "var(--color-red)" },
];

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

function resultingName(operation: CustomIdPropertyOperation): string {
    return operation.kind === "rename" ? operation.to : operation.name;
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
        return open(this.app, false, (el, finish) => {
            title(el, t("settings.properties.enable.title", { name }));
            nameBox(el, name);
            message(
                el,
                t("settings.properties.enable.body", {
                    name,
                    count: total.toLocaleString(),
                })
            );
            if (existing > 0) {
                notice(
                    el,
                    overwrite ? "warning" : "info",
                    t(
                        overwrite
                            ? "settings.properties.enable.existing_overwrite"
                            : "settings.properties.enable.existing_keep",
                        { name, existing: existing.toLocaleString() }
                    )
                );
            }
            buttons(el, finish, [
                { label: t("common.buttons.cancel"), value: false },
                {
                    label: t("settings.properties.enable.confirm"),
                    value: true,
                    cta: true,
                },
            ]);
        });
    }

    confirmRename(oldName: string, newName: string): Promise<boolean> {
        return open(this.app, false, (el, finish) => {
            title(
                el,
                t("settings.properties.rename.title", { oldName, newName })
            );
            nameBox(el, oldName, newName);
            notice(
                el,
                "info",
                t("settings.properties.rename.body", { oldName, newName })
            );
            buttons(el, finish, [
                { label: t("common.buttons.cancel"), value: false },
                {
                    label: t("settings.properties.rename.confirm"),
                    value: true,
                    cta: true,
                },
            ]);
        });
    }

    chooseClear(name: string): Promise<ClearChoice> {
        return open<ClearChoice>(this.app, "cancel", (el, finish) => {
            title(el, t("settings.properties.clear.title", { name }));
            nameBox(el, name);
            message(el, t("settings.properties.clear.body_stop", { name }));
            notice(el, "info", t("settings.properties.clear.body_scope"));
            buttons(
                el,
                finish,
                [
                    {
                        label: `${t(
                            "settings.properties.clear.remove_plugin"
                        )} ${t("settings.properties.clear.recommended")}`,
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
                true
            );
            el.createEl("p", {
                text: t("settings.properties.clear.note"),
                cls: "nexus-time-estimate nexus-custom-id-footnote",
            });
        });
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

        await open(this.app, true, (el, finish) =>
            this.buildSummary(el, finish, operation, files.length, summary)
        );
    }

    private buildSummary(
        el: HTMLElement,
        finish: (value: boolean) => void,
        operation: CustomIdPropertyOperation,
        total: number,
        summary: CustomIdPropertySummary
    ): void {
        title(el, t("settings.properties.summary.title"));

        const grid = el.createDiv({ cls: "nexus-stats-grid" });
        for (const card of SUMMARY_CARDS) {
            const count = summary[card.key];
            if (count === 0) continue;
            const cardEl = grid.createDiv({ cls: "nexus-stat-card" });
            cardEl.createDiv({ text: card.icon, cls: "nexus-stat-card-icon" });
            const value = cardEl.createDiv({
                text: count.toLocaleString(),
                cls: "nexus-stat-card-value",
            });
            value.style.color = card.color;
            cardEl.createDiv({
                text: t(`settings.properties.summary.${card.key}`),
                cls: "nexus-stat-card-label",
            });
        }

        el.createDiv({
            text: t("settings.properties.summary.context", {
                name: resultingName(operation),
                count: total.toLocaleString(),
            }),
            cls: "nexus-custom-id-context",
        });

        if (summary.failures.length > 0) {
            const box = el.createDiv({ cls: "nexus-merge-errors" });
            box.createEl("p", {
                text: t("settings.properties.summary.failures"),
            });
            const list = box.createEl("ul");
            for (const failure of summary.failures.slice(0, LISTED_FAILURES)) {
                list.createEl("li", {
                    text: `${failure.path}: ${t(
                        `settings.properties.summary.reasons.${
                            failure.reason ?? "other"
                        }`
                    )}`,
                });
            }
            const hidden = summary.failures.length - LISTED_FAILURES;
            if (hidden > 0) {
                box.createEl("p", {
                    text: t("settings.properties.summary.more_failures", {
                        count: hidden.toLocaleString(),
                    }),
                });
            }
        }

        buttons(el, finish, [
            { label: t("common.buttons.ok"), value: true, cta: true },
        ]);
    }
}
