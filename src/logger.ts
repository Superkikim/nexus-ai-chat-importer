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
export class Logger {
    debug(message: string, details?: any) {
        console.debug(message, details || '');
    }

    info(message: string, details?: any) {
        console.log(message);
    }

    warn(message: string, details?: any) {
        console.warn(message);
    }

    error(message: string, details?: any) {
        console.error(message);
    }
}

// Export singleton instance for backward compatibility
export const logger = new Logger();