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
        // Try to extract date in format YYYY-MM-DD from filename
        const dateRegex = /(\d{4})-(\d{2})-(\d{2})/;
        const match = zipFileName.match(dateRegex);
        
        if (match) {
            const [, year, month, day] = match;
            return `${year}.${month}.${day}`;
        }
        
        // Fallback: use current date if no date found in filename
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    }
    
    /**
     * Get ChatGPT provider name
     */
    getProviderName(): string {
        return "chatgpt";
    }
}