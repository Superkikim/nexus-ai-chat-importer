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


// logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

const DEFAULT_LOG_LEVEL: LogLevel = "warn";
const LOG_LEVEL_STORAGE_KEY = "nexus-ai-chat-importer:log-level";

function isValidLogLevel(value: unknown): value is LogLevel {
    return value === "debug" || value === "info" || value === "warn" || value === "error";
}

function resolveConfiguredLogLevel(): LogLevel {
    const globalValue = (globalThis as any)?.NEXUS_LOG_LEVEL;
    if (isValidLogLevel(globalValue)) {
        return globalValue;
    }

    try {
        const stored = globalThis?.localStorage?.getItem(LOG_LEVEL_STORAGE_KEY);
        if (isValidLogLevel(stored)) {
            return stored;
        }
    } catch {
        // Ignore storage access errors (private mode, restricted webview, etc.)
    }

    return DEFAULT_LOG_LEVEL;
}

export class ScopedLogger {
    constructor(private parent: Logger, private moduleName: string) {}

    debug(message: string, details?: unknown): void {
        this.parent.log("debug", this.moduleName, message, details);
    }

    info(message: string, details?: unknown): void {
        this.parent.log("info", this.moduleName, message, details);
    }

    warn(message: string, details?: unknown): void {
        this.parent.log("warn", this.moduleName, message, details);
    }

    error(message: string, details?: unknown): void {
        this.parent.log("error", this.moduleName, message, details);
    }
}

export class Logger {
    private readonly minLevel: LogLevel = resolveConfiguredLogLevel();

    debug(message: string, details?: unknown): void {
        this.log("debug", "Core", message, details);
    }

    info(message: string, details?: unknown): void {
        this.log("info", "Core", message, details);
    }

    warn(message: string, details?: unknown): void {
        this.log("warn", "Core", message, details);
    }

    error(message: string, details?: unknown): void {
        this.log("error", "Core", message, details);
    }

    child(moduleName: string): ScopedLogger {
        return new ScopedLogger(this, moduleName);
    }

    log(level: LogLevel, moduleName: string, message: string, details?: unknown): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const prefix = `[Nexus-${moduleName}][${this.formatTimestamp()}] ${message}`;

        if (level === "debug") {
            if (details !== undefined) {
                console.debug(prefix, details);
            } else {
                console.debug(prefix);
            }
            return;
        }

        if (level === "info") {
            if (details !== undefined) {
                console.log(prefix, details);
            } else {
                console.log(prefix);
            }
            return;
        }

        if (level === "warn") {
            if (details !== undefined) {
                console.warn(prefix, details);
            } else {
                console.warn(prefix);
            }
            return;
        }

        if (details !== undefined) {
            console.error(prefix, details);
        } else {
            console.error(prefix);
        }
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
    }

    private formatTimestamp(): string {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
        return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
}

// Export singleton instance for backward compatibility
export const logger = new Logger();
