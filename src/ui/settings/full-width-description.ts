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

// src/ui/settings/full-width-description.ts
import type { Setting } from "obsidian";

/**
 * Lay a setting out on two rows: its name and controls side by side, then
 * the description across the full width. Obsidian's default puts the
 * description beside the controls, which squeezes it and, once the setting
 * wraps, pushes the controls onto a line of their own.
 *
 * Call it after adding the controls; anything appended to `settingEl`
 * afterwards (a preview, a warning) follows as further full-width rows.
 */
export function setFullWidthDescription(
    setting: Setting,
    description: string | DocumentFragment
): HTMLElement {
    setting.settingEl.addClass("nexus-setting-full-width-desc");
    const row = setting.settingEl.createDiv({
        cls: "setting-item-description nexus-setting-desc-row",
    });
    if (typeof description === "string") {
        row.setText(description);
    } else {
        row.append(description);
    }
    return row;
}
