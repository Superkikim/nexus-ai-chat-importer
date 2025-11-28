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

import { App } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { NewVersionModal } from "./new-version-modal";

/**
 * Upgrade notice for v1.3.2
 * Uses the universal NewVersionModal template
 */
export class UpgradeNotice132Dialog {
    static open(app: App, plugin: NexusAiChatImporterPlugin): void {
        const fallbackMessage = `## 🔄 What Changed

**Claude changed their export format.** If you imported Claude conversations recently and noticed missing code files or strange links, v1.3.2 fixes this.

**To get your missing files back:**
1. Delete the affected conversations from your vault
2. Re-import the same ZIP file
3. Everything will be there now ✅

---

## 🐛 Bug Fixes

- **Claude artifacts now work with the new export format**
- **Fixed crashes during import** (missing logger errors)
- **Fixed weird formatting** in conversations with multiple attachments
- **Better messages** when re-importing conversations

---

## 🙏 Questions?

If something doesn't work as expected, please report it on the [forum thread](https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-and-claude-conversations-to-your-vault/71664).`;

        new NewVersionModal(
            app,
            plugin,
            "1.3.2",
            fallbackMessage,
            "1.3.2" // GitHub tag
        ).open();
    }
}

