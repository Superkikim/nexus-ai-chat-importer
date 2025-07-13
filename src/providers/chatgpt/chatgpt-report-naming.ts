// src/providers/chatgpt/chatgpt-report-naming.ts
import { ReportNamingStrategy } from "../../types/standard";

export class ChatGPTReportNamingStrategy implements ReportNamingStrategy {
    
    /**
     * Extract date prefix from ChatGPT ZIP filename
     * Examples:
     * - "3b00abafb9222a9580aa7cbb198166ed0c61634222cce9571bb079a2886aeed5-2025-04-25-14-40-42-ff19c2fd898d44d9bc5945ee80c199ca.zip"
     * - "chatgpt-export-2025-04-25.zip"
     * - "conversations-2025-04-25-14-40-42.zip"
     */
    extractReportPrefix(zipFileName: string): string {
        // Get current import date
        const now = new Date();
        const importYear = now.getFullYear();
        const importMonth = String(now.getMonth() + 1).padStart(2, '0');
        const importDay = String(now.getDate()).padStart(2, '0');
        const importDate = `${importYear}.${importMonth}.${importDay}`;
        
        // Try to extract archive date in format YYYY-MM-DD from filename
        const dateRegex = /(\d{4})-(\d{2})-(\d{2})/;
        const match = zipFileName.match(dateRegex);
        
        let archiveDate: string;
        if (match) {
            const [, year, month, day] = match;
            archiveDate = `${year}.${month}.${day}`;
        } else {
            // Fallback: use current date if no date found in filename
            archiveDate = importDate;
        }
        
        // Format: imported-YYYY.MM.DD-archive-YYYY.MM.DD
        return `imported-${importDate}-archive-${archiveDate}`;
    }
    
    /**
     * Get ChatGPT provider name
     */
    getProviderName(): string {
        return "chatgpt";
    }
}