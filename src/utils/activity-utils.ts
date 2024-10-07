// utils/activity-utils.ts

import { App, MarkdownView } from "obsidian";

export function checkAnyNexusFilesActive(app: App): boolean {
    const leaves = app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
        const view = leaf.view;

        // Check if the view is an instance of MarkdownView
        if (view instanceof MarkdownView) {
            const file = view.file; // Now TypeScript knows 'file' is available on MarkdownView
            if (file) {
                const frontmatter =
                    app.metadataCache.getFileCache(file)?.frontmatter; // Access frontmatter
                if (frontmatter?.nexus) {
                    return true; // Return true if any nexus-related files are found
                }
            }
        }
    }
    return false; // Return false if no nexus-related files are active
}
