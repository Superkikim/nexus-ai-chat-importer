// src/providers/claude/claude-report-naming.ts
import { ReportNamingStrategy } from "../../types/standard";

export class ClaudeReportNamingStrategy implements ReportNamingStrategy {
    getProviderName(): string {
        return "claude";
    }

    extractReportPrefix(zipFileName: string): string {
        // Claude export files typically follow pattern: data-YYYY-MM-DD-HH-MM-SS-batch-NNNN.zip
        // Example: data-2025-07-25-17-40-50-batch-0000.zip
        
        // Remove .zip extension
        const baseName = zipFileName.replace(/\.zip$/i, '');
        
        // Try to extract date from Claude format
        const claudePattern = /^data-(\d{4}-\d{2}-\d{2})-(\d{2}-\d{2}-\d{2})-batch-(\d{4})$/;
        const match = baseName.match(claudePattern);
        
        if (match) {
            const [, date, time, batch] = match;
            // Convert to more readable format: claude-2025.07.25-17.40.50-batch0000
            const formattedDate = date.replace(/-/g, '.');
            const formattedTime = time.replace(/-/g, '.');
            return `claude-${formattedDate}-${formattedTime}-batch${batch}`;
        }
        
        // Fallback: try to extract any date pattern
        const datePattern = /(\d{4}[-.]?\d{2}[-.]?\d{2})/;
        const dateMatch = baseName.match(datePattern);
        
        if (dateMatch) {
            const dateStr = dateMatch[1].replace(/[-]/g, '.');
            return `claude-${dateStr}`;
        }
        
        // Final fallback: use current date with original filename
        const now = new Date();
        const currentDate = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        return `claude-${currentDate}-${baseName}`;
    }

    getProviderSpecificColumn(): { header: string; getValue: (adapter: any, chat: any) => number } {
        return {
            header: "Artifacts",
            getValue: (adapter: any, chat: any) => adapter.countArtifacts ? adapter.countArtifacts(chat) : 0
        };
    }
}
