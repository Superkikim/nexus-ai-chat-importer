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

// src/dialogs/donation-dialog.ts
import { App, Modal } from "obsidian";
import { t } from "../i18n";
import { getLocalizedSupportUrl } from "../utils/support-links";

export class DonationDialog extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        modalEl.addClass("nexus-donation-dialog");
        contentEl.addClass("nexus-donation-dialog");

        titleEl.setText(t("donation_dialog.title"));

        // Hero icon
        const hero = contentEl.createDiv({ cls: "nexus-donation-hero" });
        hero.textContent = "💙";

        // Support box — reuse the gradient purple style
        const box = contentEl.createDiv({ cls: "nexus-support-box" });

        // Emphasis line (gold)
        const emphasisRow = box.createDiv({ cls: "nexus-support-message" });
        emphasisRow.createEl("p").createSpan({
            cls: "nexus-support-message-emphasis",
            text: t("donation_dialog.message_emphasis"),
        });

        // Main message
        const msgRow = box.createDiv({ cls: "nexus-support-message" });
        msgRow.createEl("p", { text: t("donation_dialog.message") });

        // Reality check box (gold tint)
        const realityCheck = box.createDiv({
            cls: "nexus-support-reality-check",
        });
        realityCheck.setText(t("donation_dialog.reality_check"));

        // CTA
        const ctaRow = box.createDiv({ cls: "nexus-support-message" });
        ctaRow.createEl("p", { text: t("donation_dialog.cta") });

        // Action buttons
        const actions = contentEl.createDiv({ cls: "nexus-donation-actions" });

        const donateBtn = actions.createEl("button", {
            text: t("donation_dialog.button_donate"),
            cls: "nexus-donation-btn-primary mod-cta",
        });
        donateBtn.addEventListener("click", () => {
            window.open(getLocalizedSupportUrl(), "_blank");
            this.close();
        });

        const laterBtn = actions.createEl("button", {
            text: t("donation_dialog.button_later"),
            cls: "nexus-donation-btn-secondary",
        });
        laterBtn.addEventListener("click", () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
