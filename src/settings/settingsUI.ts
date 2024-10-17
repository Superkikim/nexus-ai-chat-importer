// src/settings/settingsUI.ts

import { PluginSettings } from "./settings";
import { SettingsManager } from "./settingsManager";
import { Modal } from "../components/modal";

export class SettingsUI {
    private settingsManager: SettingsManager;

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
    }

    showSettings() {
        const settings = this.settingsManager.loadSettings();
        const formHtml = `
            <form>
                <label for="destinationFolder">Destination Folder:</label>
                <input type="text" id="destinationFolder" value="${
                    settings.destinationFolder
                }" />
                
                <label for="askDestinationOnImport">Ask for Destination on Import:</label>
                <input type="checkbox" id="askDestinationOnImport" ${
                    settings.askDestinationOnImport ? "checked" : ""
                } />

                <label for="addTimestampToFileName">Add Timestamp to Note Filenames:</label>
                <input type="checkbox" id="addTimestampToFileName" ${
                    settings.addTimestampToFileName ? "checked" : ""
                } />

                <label for="timestampFormat">Timestamp Format:</label>
                <select id="timestampFormat">
                    <option value="YYYY-MM-DD" ${
                        settings.timestampFormat === "YYYY-MM-DD"
                            ? "selected"
                            : ""
                    }>YYYY-MM-DD</option>
                    <option value="YYYYMMDD" ${
                        settings.timestampFormat === "YYYYMMDD"
                            ? "selected"
                            : ""
                    }>YYYYMMDD</option>
                </select>

                <button type="submit">Save</button>
            </form>
        `;

        Modal.open(formHtml);
        this.bindFormSubmission();
    }

    private bindFormSubmission() {
        const form = document.querySelector("form");
        if (form) {
            form.addEventListener("submit", (event) => {
                event.preventDefault();

                const destinationFolder = (
                    document.getElementById(
                        "destinationFolder"
                    ) as HTMLInputElement
                ).value;
                const askDestinationOnImport = (
                    document.getElementById(
                        "askDestinationOnImport"
                    ) as HTMLInputElement
                ).checked;
                const addTimestampToFileName = (
                    document.getElementById(
                        "addTimestampToFileName"
                    ) as HTMLInputElement
                ).checked;
                const timestampFormat = (
                    document.getElementById(
                        "timestampFormat"
                    ) as HTMLSelectElement
                ).value as "YYYY-MM-DD" | "YYYYMMDD";

                const newSettings: PluginSettings = {
                    destinationFolder,
                    askDestinationOnImport,
                    addTimestampToFileName,
                    timestampFormat,
                };

                this.settingsManager.saveSettings(newSettings);
                Modal.close();
            });
        }
    }
}
