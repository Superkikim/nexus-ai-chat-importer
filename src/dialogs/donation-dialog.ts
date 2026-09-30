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
import { createSupportBox } from "../ui/components/support-box";

export class DonationDialog extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        contentEl.empty();
        modalEl.addClass("nexus-donation-dialog");

        const supportLink = createSupportBox(contentEl);
        supportLink.addEventListener("click", () => this.close());

        const laterBtn = contentEl.createEl("button", {
            text: t("support_box.button_later"),
            cls: "nexus-donation-later",
        });
        laterBtn.addEventListener("click", () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }
}
