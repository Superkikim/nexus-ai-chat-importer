// src/settings/settings.ts

export interface PluginSettings {
    destinationFolder: string; // Folder where the imported notes will be saved
    askDestinationOnImport: boolean; // Option to ask for the destination folder each time
    addTimestampToFileName: boolean; // Option to add a timestamp to the note filenames
    timestampFormat: "YYYY-MM-DD" | "YYYYMMDD"; // Format for timestamps
}

export const defaultSettings: PluginSettings = {
    destinationFolder: "",
    askDestinationOnImport: false,
    addTimestampToFileName: false,
    timestampFormat: "YYYY-MM-DD", // Default timestamp format
};
