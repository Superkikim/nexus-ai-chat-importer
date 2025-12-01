import { ensureFolderExists } from "../utils";
import type NexusAiChatImporterPlugin from "../main";

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Lightweight file logger for import sessions. Writes to the Report folder so
 * logs persist even when the UI hangs.
 */
export class SessionLogger {
    private logFilePath: string;
    private initialized = false;

    private constructor(private plugin: NexusAiChatImporterPlugin, sessionName: string) {
        const reportFolder = this.plugin.settings.reportFolder || "Nexus/Reports";
        this.logFilePath = `${reportFolder}/debug/${sessionName}.log`;
    }

    static async create(plugin: NexusAiChatImporterPlugin, sessionName: string): Promise<SessionLogger> {
        const logger = new SessionLogger(plugin, sessionName);
        await logger.init();
        return logger;
    }

    private async init(): Promise<void> {
        if (this.initialized) return;
        const folderPath = this.logFilePath.substring(0, this.logFilePath.lastIndexOf("/"));
        await ensureFolderExists(folderPath, this.plugin.app.vault);
        const header = `\n\n===== Import session ${new Date().toISOString()} =====\n`;
        await this.appendRaw(header);
        this.initialized = true;
    }

    async log(level: LogLevel, message: string, details?: any): Promise<void> {
        const timestamp = new Date().toISOString();
        let line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        if (details !== undefined) {
            try {
                line += ` | details=${JSON.stringify(details, null, 2)}`;
            } catch (err) {
                line += ` | details=<unserializable>`;
            }
        }
        line += "\n";
        await this.appendRaw(line);
    }

    getPath(): string {
        return this.logFilePath;
    }

    private async appendRaw(text: string): Promise<void> {
        await this.plugin.app.vault.adapter.append(this.logFilePath, text);
    }
}
