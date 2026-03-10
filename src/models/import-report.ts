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


// src/models/import-report.ts
import { AttachmentStats, MessageTimestampFormat } from "../types/plugin";
import { formatMessageTimestamp } from "../utils";

interface ReportEntry {
    title: string;
    filePath: string;
    createTime: number; // Unix timestamp (seconds)
    updateTime: number; // Unix timestamp (seconds)
    messageCount?: number;
    newMessageCount?: number; // For updates
    providerSpecificCount?: number; // For provider-specific column (artifacts, attachments, etc.)
    reason?: string;
    errorMessage?: string;
    attachmentStats?: AttachmentStats;
    sourceFile?: string; // Track which ZIP file this entry came from
}

interface ProcessingCounters {
    totalConversationsProcessed: number;
    totalNewConversationsSuccessfullyImported: number;
    totalConversationsActuallyUpdated: number;
    totalNonEmptyMessagesAdded: number;
}

interface FileSection {
    fileName: string;
    created: ReportEntry[];
    updated: ReportEntry[];
    skipped: ReportEntry[];
    failed: ReportEntry[];
    counters: ProcessingCounters;
}

interface ReportCrossLinks {
    summaryFileName: string;
    heavyFileName: string;
    mobileFileName: string;
}

interface IgnoredArchiveDetail {
    fileName: string;
    reason: string;
    message: string;
}

export class ImportReport {
    private fileSections: Map<string, FileSection> = new Map();
    private currentFileName: string = "";
    private globalErrors: { message: string; details: string }[] = [];
    private providerSpecificColumnHeader: string = "Attachments";
    private operationStartTime: number = Date.now();
    private fileStats?: Map<string, any>; // Store file analysis stats for duplicate counting
    private analysisInfo?: any; // Store analysis info for completion stats
    private customTimestampFormat?: MessageTimestampFormat; // Custom format for report dates
    private ignoredArchiveDetails: Map<string, IgnoredArchiveDetail> = new Map();

    /**
     * Start a new file section for multi-file imports
     */
    startFileSection(fileName: string) {
        this.currentFileName = fileName;
        if (!this.fileSections.has(fileName)) {
            this.fileSections.set(fileName, {
                fileName,
                created: [],
                updated: [],
                skipped: [],
                failed: [],
                counters: {
                    totalConversationsProcessed: 0,
                    totalNewConversationsSuccessfullyImported: 0,
                    totalConversationsActuallyUpdated: 0,
                    totalNonEmptyMessagesAdded: 0
                }
            });
        }
    }

    /**
     * Set counters for the current file section
     */
    setFileCounters(counters: ProcessingCounters) {
        const section = this.getCurrentSection();
        if (section) {
            section.counters = counters;
        }
    }

    private getCurrentSection(): FileSection | undefined {
        return this.fileSections.get(this.currentFileName);
    }

    setProviderSpecificColumnHeader(header: string) {
        this.providerSpecificColumnHeader = header;
    }

    setCustomTimestampFormat(format?: MessageTimestampFormat) {
        this.customTimestampFormat = format;
    }

    /**
     * Legacy method for backward compatibility (single file imports)
     */
    addSummary(zipFileName: string, counters: ProcessingCounters) {
        // For single file imports, just start a section and set counters
        this.startFileSection(zipFileName);
        this.setFileCounters(counters);
    }

    private getTotalAttachmentStats(): AttachmentStats {
        const total = { total: 0, found: 0, missing: 0, failed: 0 };

        this.fileSections.forEach(section => {
            [...section.created, ...section.updated].forEach(entry => {
                // Count regular attachments (uploaded files)
                if (entry.attachmentStats) {
                    total.total += entry.attachmentStats.total;
                    total.found += entry.attachmentStats.found;
                    total.missing += entry.attachmentStats.missing;
                    total.failed += entry.attachmentStats.failed;
                }

                // Count artifacts as attachments (they are stored in attachmentFolder)
                if (entry.providerSpecificCount) {
                    total.total += entry.providerSpecificCount;
                    total.found += entry.providerSpecificCount; // Artifacts are always successfully created
                }
            });
        });

        return total;
    }

    private getFileSectionAttachmentStats(section: FileSection): AttachmentStats {
        const total = { total: 0, found: 0, missing: 0, failed: 0 };

        [...section.created, ...section.updated].forEach(entry => {
            // Count regular attachments (uploaded files)
            if (entry.attachmentStats) {
                total.total += entry.attachmentStats.total;
                total.found += entry.attachmentStats.found;
                total.missing += entry.attachmentStats.missing;
                total.failed += entry.attachmentStats.failed;
            }

            // Count artifacts as attachments (they are stored in attachmentFolder)
            if (entry.providerSpecificCount) {
                total.total += entry.providerSpecificCount;
                total.found += entry.providerSpecificCount; // Artifacts are always successfully created
            }
        });

        return total;
    }

    private getGlobalStats() {
        let created = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        let totalProcessed = 0;
        let newMessages = 0;

        this.fileSections.forEach(section => {
            created += section.created.length;
            updated += section.updated.length;
            skipped += section.skipped.length;
            failed += section.failed.length;
            totalProcessed += section.counters.totalConversationsProcessed;
            newMessages += section.counters.totalNonEmptyMessagesAdded;
        });

        return { created, updated, skipped, failed, totalProcessed, newMessages };
    }

    addCreated(title: string, filePath: string, createTime: number, updateTime: number, messageCount: number, attachmentStats?: AttachmentStats, providerSpecificCount?: number) {
        const section = this.getCurrentSection();
        if (section) {
            section.created.push({ title, filePath, createTime, updateTime, messageCount, attachmentStats, providerSpecificCount, sourceFile: this.currentFileName });
        }
    }

    addUpdated(title: string, filePath: string, createTime: number, updateTime: number, newMessageCount: number, attachmentStats?: AttachmentStats, providerSpecificCount?: number) {
        const section = this.getCurrentSection();
        if (section) {
            section.updated.push({ title, filePath, createTime, updateTime, newMessageCount, attachmentStats, providerSpecificCount, sourceFile: this.currentFileName });
        }
    }

    addSkipped(title: string, filePath: string, createTime: number, updateTime: number, messageCount: number, reason: string, attachmentStats?: AttachmentStats, providerSpecificCount?: number) {
        const section = this.getCurrentSection();
        if (section) {
            section.skipped.push({ title, filePath, createTime, updateTime, messageCount, reason, attachmentStats, providerSpecificCount, sourceFile: this.currentFileName });
        }
    }

    addFailed(title: string, filePath: string, createTime: number, updateTime: number, errorMessage: string) {
        const section = this.getCurrentSection();
        if (section) {
            section.failed.push({ title, filePath, createTime, updateTime, errorMessage, sourceFile: this.currentFileName });
        }
    }

    addError(message: string, details: string) {
        this.globalErrors.push({ message, details });
    }

    generateSummaryReportContent(
        allFiles?: File[],
        processedFiles?: string[],
        skippedFiles?: string[],
        analysisInfo?: any,
        fileStats?: Map<string, any>,
        isSelectiveImport?: boolean,
        archiveDisplayNames?: Map<string, string>,
        links?: ReportCrossLinks
    ): string {
        const stats = this.getGlobalStats();
        const totalAttachments = this.getTotalAttachmentStats();
        const totalFilesAnalyzed = allFiles ? allFiles.length : this.fileSections.size;
        const processedSet = new Set(processedFiles || []);
        const skippedSet = new Set(skippedFiles || []);

        const lines: string[] = [];
        lines.push("# Nexus AI Chat Importer Summary");
        lines.push("");

        if (links) {
            lines.push(`- Heavy index: [[${links.heavyFileName}]]`);
            lines.push(`- Mobile index: [[${links.mobileFileName}]]`);
            lines.push("");
        }

        lines.push("## Overview");
        lines.push("");
        lines.push("### Files");
        lines.push("");
        lines.push("| Metric | Value |");
        lines.push("| --- | ---: |");
        lines.push(`| Analyzed | ${totalFilesAnalyzed} |`);
        lines.push(`| Processed | ${processedSet.size} |`);
        lines.push(`| Skipped | ${skippedSet.size} |`);
        lines.push("");

        lines.push("### Conversations");
        lines.push("");
        lines.push("| Metric | Value |");
        lines.push("| --- | ---: |");
        lines.push(`| Created | ${stats.created} |`);
        lines.push(`| Updated | ${stats.updated} |`);
        lines.push(`| Skipped | ${analysisInfo?.conversationsIgnored ?? stats.skipped} |`);
        lines.push(`| Failed | ${stats.failed} |`);
        if (analysisInfo) {
            lines.push(`| Found (raw) | ${analysisInfo.totalConversationsFound || 0} |`);
            lines.push(`| Kept (unique) | ${analysisInfo.uniqueConversationsKept || 0} |`);
            lines.push(`| Duplicates removed | ${analysisInfo.duplicatesRemoved || 0} |`);
        }
        lines.push("");

        lines.push("### Attachments");
        lines.push("");
        lines.push("| Metric | Value |");
        lines.push("| --- | ---: |");
        lines.push(`| Extracted | ${totalAttachments.found}/${totalAttachments.total} |`);
        lines.push(`| Missing | ${totalAttachments.missing} |`);
        lines.push(`| Failed | ${totalAttachments.failed} |`);
        lines.push("");

        if (allFiles && allFiles.length > 0) {
            const sortedFiles = [...allFiles].sort((a, b) => a.lastModified - b.lastModified);
            lines.push("## Archives");
            lines.push("");
            lines.push("| Archive | Status | Reason | Conversations | Selected | Created | Updated | Failed | Duplicates |");
            lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");

            for (const file of sortedFiles) {
                const section = this.fileSections.get(file.name);
                const perFileStats = fileStats?.get(file.name);
                const shortName = archiveDisplayNames?.get(file.name) || file.name;
                const selectedCount = perFileStats?.selectedForImport ?? ((section?.created.length || 0) + (section?.updated.length || 0));
                const createdCount = section?.created.length || 0;
                const updatedCount = section?.updated.length || 0;
                const failedCount = section?.failed.length || 0;
                const duplicateCount = perFileStats?.duplicates ?? 0;
                const conversationCount = perFileStats?.totalConversations ?? selectedCount;
                const status = processedSet.has(file.name) ? "processed" : "skipped";
                const reason = this.buildArchiveReason(file.name, status, isSelectiveImport);

                lines.push(`| \`${shortName}\` | ${status} | ${reason} | ${conversationCount} | ${selectedCount} | ${createdCount} | ${updatedCount} | ${failedCount} | ${duplicateCount} |`);
            }
            lines.push("");

            if (archiveDisplayNames && archiveDisplayNames.size > 0) {
                lines.push("## Archive Name Map");
                lines.push("");
                lines.push("| Short Name | Original File Name |");
                lines.push("| --- | --- |");
                for (const file of sortedFiles) {
                    const shortName = archiveDisplayNames.get(file.name);
                    if (!shortName || shortName === file.name) {
                        continue;
                    }
                    lines.push(`| \`${shortName}\` | \`${file.name}\` |`);
                }
                lines.push("");
            }
        }

        if (this.globalErrors.length > 0) {
            lines.push("## Global Errors");
            lines.push("");
            for (const entry of this.globalErrors) {
                lines.push(`- **${entry.message}**: ${entry.details}`);
            }
            lines.push("");
        } else if (isSelectiveImport) {
            lines.push("## Global Errors");
            lines.push("");
            lines.push("- None");
            lines.push("");
        }

        return lines.join("\n");
    }

    generateHeavyIndexContent(
        allFiles?: File[],
        links?: ReportCrossLinks
    ): string {
        const stats = this.getGlobalStats();
        const fileNames = this.getOrderedFileNames(allFiles);
        const lines: string[] = [];

        lines.push("# Nexus AI Chat Importer Index (Heavy)");
        lines.push("");
        if (links) {
            lines.push(`- Summary: [[${links.summaryFileName}]]`);
            lines.push(`- Mobile index: [[${links.mobileFileName}]]`);
            lines.push("");
        }
        lines.push("## Index Summary");
        lines.push("");
        lines.push(`- Created: ${stats.created}`);
        lines.push(`- Updated: ${stats.updated}`);
        lines.push(`- Failed: ${stats.failed}`);
        lines.push(`- Files with entries: ${fileNames.length}`);
        lines.push("");

        if (fileNames.length === 0) {
            lines.push("No indexed conversations.");
            lines.push("");
            return lines.join("\n");
        }

        const multipleFiles = fileNames.length > 1;
        for (let index = 0; index < fileNames.length; index++) {
            const fileName = fileNames[index];
            const section = this.fileSections.get(fileName);
            if (!section) {
                continue;
            }

            if (multipleFiles) {
                lines.push(`## ${fileName}`);
                lines.push("");
            }

            const sectionContent = this.generateFileContent(section, multipleFiles).trim();
            if (sectionContent.length > 0) {
                lines.push(sectionContent);
                lines.push("");
            }
        }

        return lines.join("\n");
    }

    generateMobileIndexContent(
        allFiles?: File[],
        links?: ReportCrossLinks
    ): string {
        const fileNames = this.getOrderedFileNames(allFiles);
        const createdOrUpdatedByPath = new Map<string, {
            title: string;
            filePath: string;
            updateTime: number;
            sourceFile?: string;
            status: "created" | "updated";
        }>();
        const failedEntries: ReportEntry[] = [];

        const upsertEntry = (entry: ReportEntry, status: "created" | "updated") => {
            const current = createdOrUpdatedByPath.get(entry.filePath);
            if (!current) {
                createdOrUpdatedByPath.set(entry.filePath, {
                    title: entry.title,
                    filePath: entry.filePath,
                    updateTime: entry.updateTime,
                    sourceFile: entry.sourceFile,
                    status,
                });
                return;
            }

            const shouldRefreshMetadata = entry.updateTime >= current.updateTime;
            createdOrUpdatedByPath.set(entry.filePath, {
                title: shouldRefreshMetadata ? entry.title : current.title,
                filePath: current.filePath,
                updateTime: shouldRefreshMetadata ? entry.updateTime : current.updateTime,
                sourceFile: shouldRefreshMetadata ? entry.sourceFile : current.sourceFile,
                status: current.status === "updated" || status === "updated" ? "updated" : "created",
            });
        };

        for (const fileName of fileNames) {
            const section = this.fileSections.get(fileName);
            if (!section) {
                continue;
            }

            for (const entry of section.created) {
                upsertEntry(entry, "created");
            }
            for (const entry of section.updated) {
                upsertEntry(entry, "updated");
            }

            failedEntries.push(...section.failed);
        }

        const indexedEntries = Array.from(createdOrUpdatedByPath.values());
        const createdEntries = indexedEntries
            .filter((entry) => entry.status === "created")
            .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
        const updatedEntries = indexedEntries
            .filter((entry) => entry.status === "updated")
            .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

        const sortedAllEntries = [...indexedEntries].sort((a, b) => {
            return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        });

        const lines: string[] = [];
        lines.push("# Nexus AI Chat Importer Index (Mobile)");
        lines.push("");
        if (links) {
            lines.push(`- Summary: [[${links.summaryFileName}]]`);
            lines.push(`- Heavy index: [[${links.heavyFileName}]]`);
            lines.push("");
        }
        lines.push("## Index Summary");
        lines.push("");
        lines.push(`- Conversations listed: ${sortedAllEntries.length}`);
        lines.push(`- New notes: ${createdEntries.length}`);
        lines.push(`- Updated notes: ${updatedEntries.length}`);
        lines.push(`- Failed conversations: ${failedEntries.length}`);
        lines.push("");

        lines.push("## ✨ New Notes");
        lines.push("");
        if (createdEntries.length === 0) {
            lines.push("- None");
            lines.push("");
        } else {
            for (const entry of createdEntries) {
                const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
                const titleLink = `[[${entry.filePath}\\|${sanitizedTitle}]]`;
                lines.push(`- ✨ ${titleLink}`);
            }
            lines.push("");
        }

        lines.push("## 🔄 Updated Notes");
        lines.push("");
        if (updatedEntries.length === 0) {
            lines.push("- None");
            lines.push("");
        } else {
            for (const entry of updatedEntries) {
                const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
                const titleLink = `[[${entry.filePath}\\|${sanitizedTitle}]]`;
                lines.push(`- 🔄 ${titleLink}`);
            }
            lines.push("");
        }

        if (failedEntries.length > 0) {
            const sortedFailures = [...failedEntries].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
            lines.push("## Failed");
            lines.push("");
            for (const entry of sortedFailures) {
                const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
                lines.push(`- ${sanitizedTitle} — ${entry.errorMessage || "Unknown error"}`);
            }
            lines.push("");
        }

        return lines.join("\n");
    }

    generateReportContent(
        allFiles?: File[],
        processedFiles?: string[],
        skippedFiles?: string[],
        analysisInfo?: any,
        fileStats?: Map<string, any>,
        isSelectiveImport?: boolean
    ): string {
        let content = "# Nexus AI Chat Importer Report\n\n";

        // Generate global summary
        content += this.generateGlobalSummary(allFiles, processedFiles, skippedFiles, analysisInfo, fileStats, isSelectiveImport) + "\n\n";

        // Show skipped files section if any
        if (skippedFiles && skippedFiles.length > 0) {
            content += this.generateSkippedFilesSection(skippedFiles, isSelectiveImport) + "\n\n";
        }

        // Generate section for each file
        const fileNames = Array.from(this.fileSections.keys());

        if (fileNames.length === 0) {
            // No files were processed
            content += "## Result\n\n";
            content += "No conversations were imported. All conversations are already up to date.\n\n";
        } else if (fileNames.length === 1) {
            // Single file import - use simplified format
            const section = this.fileSections.get(fileNames[0])!;
            content += this.generateFileContent(section, false);
        } else {
            // Multi-file import - chaptered by file
            content += "---\n\n";
            content += "## Processed Files\n\n";
            fileNames.forEach((fileName, index) => {
                const section = this.fileSections.get(fileName)!;
                content += `### File ${index + 1}: ${fileName}\n\n`;
                content += this.generateFileSummary(section) + "\n\n";
                content += this.generateFileContent(section, true);
                if (index < fileNames.length - 1) {
                    content += "\n";
                }
            });
        }

        // Global errors at the end
        if (this.globalErrors.length > 0) {
            content += `---\n\n`;
            content += this.generateErrorTable();
        }

        return content;
    }

    private getOrderedFileNames(allFiles?: File[]): string[] {
        if (!allFiles || allFiles.length === 0) {
            return Array.from(this.fileSections.keys());
        }

        const sortedFiles = [...allFiles].sort((a, b) => a.lastModified - b.lastModified);
        const orderedNames: string[] = [];

        for (const file of sortedFiles) {
            if (this.fileSections.has(file.name)) {
                orderedNames.push(file.name);
            }
        }

        return orderedNames;
    }

    private generateSkippedFilesSection(skippedFiles: string[], isSelectiveImport?: boolean): string {
        const title = isSelectiveImport
            ? "⏭️ Skipped Files (No Selected Conversations)"
            : "⏭️ Skipped Files (Already Up to Date)";

        const explanation = isSelectiveImport
            ? "Files not processed because they contain no selected conversations"
            : "Files analyzed but not processed because all conversations are already up to date";

        let section = `> [!note]- ${title}\n`;
        section += `> ${explanation}\n`;
        section += `> \n`;
        section += `> **Total:** ${skippedFiles.length} files\n`;
        section += `> \n`;
        section += `> <details>\n`;
        section += `> <summary>View file list</summary>\n`;
        section += `> \n`;
        skippedFiles.forEach(fileName => {
            const reason = this.buildArchiveReason(fileName, "skipped", isSelectiveImport);
            section += `> - \`${fileName}\` — ${reason}\n`;
        });
        section += `> \n`;
        section += `> </details>\n`;

        return section;
    }

    private generateGlobalSummary(
        allFiles?: File[],
        processedFiles?: string[],
        skippedFiles?: string[],
        analysisInfo?: any,
        fileStats?: Map<string, any>,
        isSelectiveImport?: boolean
    ): string {
        const stats = this.getGlobalStats();
        const totalAttachments = this.getTotalAttachmentStats();
        const fileCount = this.fileSections.size;
        const totalFilesAnalyzed = allFiles ? allFiles.length : fileCount;
        const filesSkipped = skippedFiles ? skippedFiles.length : 0;

        let summary = `## 📊 Import Summary\n\n`;

        // Files analyzed table - show all files with their status
        if (allFiles && allFiles.length > 0) {
            summary += `### 📦 Files Analyzed\n\n`;
            summary += `| File | Conversations | Duplicates | Skipped | Selected | Created | Updated |\n`;
            summary += `|:---|---:|---:|---:|---:|---:|---:|\n`;

            // Combine all files (processed and skipped) with their stats
            interface FileInfo {
                name: string;
                file?: File;
            }

            const fileInfos: FileInfo[] = [];

            // Add all files
            allFiles.forEach(file => {
                fileInfos.push({
                    name: file.name,
                    file: file
                });
            });

            // Sort by file lastModified date (oldest first)
            fileInfos.sort((a, b) => {
                const timeA = a.file?.lastModified || 0;
                const timeB = b.file?.lastModified || 0;
                return timeA - timeB; // Ascending order (oldest first)
            });

            // Generate table rows using fileStats
            fileInfos.forEach(info => {
                const stats = fileStats?.get(info.name);
                const section = this.fileSections.get(info.name);

                if (stats) {
                    // Use analysis stats from metadata extraction
                    const created = section?.created.length || 0;
                    const updated = section?.updated.length || 0;
                    const skipped = stats.skippedConversations || 0;

                    summary += `| \`${info.name}\` | ${stats.totalConversations} | ${stats.duplicates} | ${skipped} | ${stats.selectedForImport} | ${created} | ${updated} |\n`;
                } else {
                    // File was skipped or no stats available
                    summary += `| \`${info.name}\` | - | - | - | - | 0 | 0 |\n`;
                }
            });

            summary += `\n`;
        }

        // Global stats callout - only show if NOT selective import
        if (analysisInfo && !isSelectiveImport) {
            summary += `> [!info]- 🔍 Global Statistics\n`;
            summary += `> \n`;
            summary += `> | Metric | Count |\n`;
            summary += `> |:---|---:|\n`;
            summary += `> | Total Conversations Found | ${analysisInfo.totalConversationsFound || 0} |\n`;
            summary += `> | Unique Conversations | ${analysisInfo.uniqueConversationsKept || 0} |\n`;
            if (analysisInfo.duplicatesRemoved > 0) {
                summary += `> | Duplicates Removed | ${analysisInfo.duplicatesRemoved} |\n`;
            }
            summary += `> | New | ${analysisInfo.conversationsNew || 0} |\n`;
            summary += `> | Updated | ${analysisInfo.conversationsUpdated || 0} |\n`;
            summary += `> | Skipped | ${analysisInfo.conversationsIgnored || 0} |\n`;
            summary += `\n`;
        }

        // Import results summary
        summary += `### 📥 Import Summary\n\n`;
        summary += `| Category | Count |\n`;
        summary += `|:---|---:|\n`;
        summary += `| **Total Imported** | **${stats.created + stats.updated}** |\n`;
        summary += `| ✨ Created | ${stats.created} |\n`;
        summary += `| 🔄 Updated | ${stats.updated}`;
        if (stats.newMessages > 0) {
            summary += ` (${stats.newMessages} new messages)`;
        }
        summary += ` |\n`;

        if (stats.skipped > 0) {
            summary += `| ⏭️ Skipped (unchanged) | ${stats.skipped} |\n`;
        }
        if (stats.failed > 0) {
            summary += `| ❌ Failed | ${stats.failed} |\n`;
        }
        if (this.globalErrors.length > 0) {
            summary += `| ⚠️ Errors | ${this.globalErrors.length} |\n`;
        }

        if (totalAttachments.total > 0) {
            const attachmentIcon = totalAttachments.found === totalAttachments.total ? '✅' :
                                   totalAttachments.found === 0 ? '❌' : '⚠️';
            summary += `| ${attachmentIcon} Attachments | ${totalAttachments.found}/${totalAttachments.total} |\n`;
            if (totalAttachments.missing > 0 || totalAttachments.failed > 0) {
                summary += `| └─ Missing | ${totalAttachments.missing} |\n`;
                summary += `| └─ Failed | ${totalAttachments.failed} |\n`;
            }
        }

        return summary;
    }

    private generateFileSummary(section: FileSection): string {
        const attachmentStats = this.getFileSectionAttachmentStats(section);
        const attachmentSummary = attachmentStats.total > 0
            ? `\n- **Attachments**: ${attachmentStats.found}/${attachmentStats.total} extracted`
            : "";

        return `### Statistics
- **Created**: ${section.created.length}
- **Updated**: ${section.updated.length} (${section.counters.totalNonEmptyMessagesAdded} new messages)
- **Skipped**: ${section.skipped.length}
- **Failed**: ${section.failed.length}${attachmentSummary}`;
    }

    private generateFileContent(section: FileSection, isMultiFile: boolean): string {
        let content = "";

        if (section.created.length > 0) {
            content += this.generateCreatedTable(section.created, isMultiFile);
        }

        if (section.updated.length > 0) {
            content += this.generateUpdatedTable(section.updated, isMultiFile);
        }

        if (section.failed.length > 0) {
            content += this.generateFailedTable(section.failed, isMultiFile);
        }

        return content;
    }

    private generateCreatedTable(entries: ReportEntry[], isMultiFile: boolean): string {
        const header = isMultiFile ? "### ✨ Created Notes" : "## ✨ Created Notes";
        let table = `${header}\n\n`;
        table += `| | Title | Created | Messages | ${this.providerSpecificColumnHeader} |\n`;
        table += "|:---:|:---|:---:|:---:|:---:|\n";

        // Sort by createTime (oldest first, newest at bottom) - numeric sort
        const sortedEntries = [...entries].sort((a, b) => {
            return a.createTime - b.createTime;
        });

        sortedEntries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const titleLink = `[[${entry.filePath}\\|${sanitizedTitle}]]`;
            const providerSpecificValue = entry.providerSpecificCount || 0;

            // Format timestamp with custom format or default
            const createDate = formatMessageTimestamp(entry.createTime, this.customTimestampFormat);

            // Add green checkmark for artifacts/attachments when > 0
            const providerSpecificDisplay = providerSpecificValue > 0 ? `✅ ${providerSpecificValue}` : providerSpecificValue;

            table += `| ✨ | ${titleLink} | ${createDate} | ${entry.messageCount || 0} | ${providerSpecificDisplay} |\n`;
        });

        return table + "\n\n";
    }

    private generateUpdatedTable(entries: ReportEntry[], isMultiFile: boolean): string {
        const header = isMultiFile ? "### 🔄 Updated Notes" : "## 🔄 Updated Notes";
        let table = `${header}\n\n`;
        table += `| | Title | Updated | New Messages | New ${this.providerSpecificColumnHeader} |\n`;
        table += "|:---:|:---|:---:|:---:|:---:|\n";

        // Sort by updateTime (oldest first, newest at bottom) - numeric sort
        const sortedEntries = [...entries].sort((a, b) => {
            return a.updateTime - b.updateTime;
        });

        sortedEntries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const titleLink = `[[${entry.filePath}\\|${sanitizedTitle}]]`;
            const providerSpecificValue = entry.providerSpecificCount || 0;

            // Format timestamp with custom format or default
            const updateDate = formatMessageTimestamp(entry.updateTime, this.customTimestampFormat);

            // Add green checkmark for artifacts/attachments when > 0
            const providerSpecificDisplay = providerSpecificValue > 0 ? `✅ ${providerSpecificValue}` : providerSpecificValue;

            table += `| 🔄 | ${titleLink} | ${updateDate} | ${entry.newMessageCount || 0} | ${providerSpecificDisplay} |\n`;
        });

        return table + "\n\n";
    }

    private generateFailedTable(entries: ReportEntry[], isMultiFile: boolean): string {
        const header = isMultiFile ? "### 🚫 Failed Imports" : "## 🚫 Failed Imports";
        let table = `${header}\n\n`;
        table += "| | Title | Date | Error |\n";
        table += "|:---:|:---|:---:|:---|\n";

        // Sort by createTime (oldest first, newest at bottom) - numeric sort
        const sortedEntries = [...entries].sort((a, b) => {
            return a.createTime - b.createTime;
        });

        sortedEntries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            // Format timestamp with custom format or default
            const createDate = formatMessageTimestamp(entry.createTime, this.customTimestampFormat);
            table += `| 🚫 | ${sanitizedTitle} | ${createDate} | ${entry.errorMessage || "Unknown error"} |\n`;
        });

        return table + "\n\n";
    }

    private generateErrorTable(): string {
        let table = `## ⚠️ Global Errors\n\n`;
        table += "| | Error | Details |\n";
        table += "|:---:|:---|:---|\n";
        
        this.globalErrors.forEach((entry) => {
            table += `| ⚠️ | ${entry.message} | ${entry.details} |\n`;
        });
        
        return table + "\n\n";
    }

    private formatAttachmentStatus(stats?: AttachmentStats): string {
        if (!stats || stats.total === 0) {
            return "0";
        }

        const { total, found, missing, failed } = stats;
        
        if (found === total) {
            return `✅ ${found}`;
        } else if (found === 0) {
            return `❌ 0/${total}`;
        } else {
            return `⚠️ ${found}/${total}`;
        }
    }

    hasErrors(): boolean {
        let hasFailed = false;
        this.fileSections.forEach(section => {
            if (section.failed.length > 0) {
                hasFailed = true;
            }
        });
        return hasFailed || this.globalErrors.length > 0;
    }

    getCreatedCount(): number {
        let count = 0;
        this.fileSections.forEach(section => {
            count += section.created.length;
        });
        return count;
    }

    getUpdatedCount(): number {
        let count = 0;
        this.fileSections.forEach(section => {
            count += section.updated.length;
        });
        return count;
    }

    getSkippedCount(): number {
        let count = 0;
        this.fileSections.forEach(section => {
            count += section.skipped.length;
        });
        return count;
    }

    getFailedCount(): number {
        let count = 0;
        this.fileSections.forEach(section => {
            count += section.failed.length;
        });
        return count;
    }

    /**
     * Store file analysis stats for duplicate counting
     */
    setFileStats(fileStats: Map<string, any>) {
        this.fileStats = fileStats;
    }

    /**
     * Store analysis info for completion stats
     */
    setAnalysisInfo(analysisInfo: any) {
        this.analysisInfo = analysisInfo;
    }

    setIgnoredArchives(ignoredArchives: IgnoredArchiveDetail[]) {
        this.ignoredArchiveDetails.clear();
        ignoredArchives.forEach((archive) => {
            this.ignoredArchiveDetails.set(archive.fileName, archive);
        });
    }

    /**
     * Calculate total duplicates from file stats
     */
    private getTotalDuplicates(): number {
        if (!this.fileStats) return 0;

        let totalDuplicates = 0;
        this.fileStats.forEach(stats => {
            totalDuplicates += stats.duplicates || 0;
        });
        return totalDuplicates;
    }

    /**
     * Get statistics for the completion dialog
     */
    getCompletionStats() {
        const globalStats = this.getGlobalStats();
        const attachmentStats = this.getTotalAttachmentStats();

        // Use analysisInfo for accurate counts if available
        const totalConversations = this.analysisInfo?.uniqueConversationsKept ?? globalStats.totalProcessed;
        const duplicates = this.analysisInfo?.duplicatesRemoved ?? this.getTotalDuplicates();
        const skipped = this.analysisInfo?.conversationsIgnored ?? globalStats.skipped;

        return {
            totalFiles: this.fileSections.size,
            totalConversations: totalConversations,
            duplicates: duplicates,
            created: globalStats.created,
            updated: globalStats.updated,
            skipped: skipped,
            failed: globalStats.failed,
            attachmentsFound: attachmentStats.found,
            attachmentsTotal: attachmentStats.total,
            attachmentsMissing: attachmentStats.missing,
            attachmentsFailed: attachmentStats.failed
        };
    }

    /**
     * Get list of processed file names
     */
    getProcessedFileNames(): string[] {
        return Array.from(this.fileSections.keys());
    }

    private buildArchiveReason(
        fileName: string,
        status: "processed" | "skipped",
        isSelectiveImport?: boolean
    ): string {
        if (status === "processed") {
            return "imported";
        }

        const ignored = this.ignoredArchiveDetails.get(fileName);
        if (ignored) {
            return `${this.formatIgnoredArchiveReason(ignored.reason)}: ${ignored.message}`;
        }

        return isSelectiveImport ? "no selected conversations" : "no importable conversations";
    }

    private formatIgnoredArchiveReason(reason: string): string {
        switch (reason) {
            case "provider-mismatch":
                return "provider mismatch";
            case "unsupported-format":
                return "unsupported format";
            case "empty":
                return "empty archive";
            case "read-error":
                return "read error";
            default:
                return reason;
        }
    }
}
