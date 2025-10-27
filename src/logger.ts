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
enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

export class Logger {
    private logToConsole(level: LogLevel, message: string, details?: any) {
        // SOLUTION BRUTALE : console.log direct
        console.log(`[Nexus AI Chat Importer] [${LogLevel[level]}] ${message}`);
    }

    debug(message: string, details?: any) {
        // DEBUG logs are only shown in console when developer tools are open
        console.debug(`[Nexus AI Chat Importer] [DEBUG] ${message}`, details || '');
    }

    info(message: string, details?: any) {
        console.log(`[Nexus AI Chat Importer] [INFO] ${message}`);
    }

    warn(message: string, details?: any) {
        console.warn(`[Nexus AI Chat Importer] [WARN] ${message}`);
    }

    error(message: string, details?: any) {
        console.error(`[Nexus AI Chat Importer] [ERROR] ${message}`);
    }
}

// Export singleton instance
export const logger = new Logger();