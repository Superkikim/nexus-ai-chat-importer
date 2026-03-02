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
