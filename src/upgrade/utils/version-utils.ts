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


// src/upgrade/utils/version-utils.ts

export interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    original: string;
}

export class VersionUtils {
    /**
     * Parse version string into components
     */
    static parseVersion(version: string): ParsedVersion {
        const parts = version.split('.').map(Number);
        return {
            major: parts[0] || 0,
            minor: parts[1] || 0, 
            patch: parts[2] || 0,
            original: version
        };
    }

    /**
     * Compare two versions
     * Returns: -1 (v1 < v2), 0 (v1 = v2), 1 (v1 > v2)
     */
    static compareVersions(version1: string, version2: string): number {
        const v1 = this.parseVersion(version1);
        const v2 = this.parseVersion(version2);

        if (v1.major !== v2.major) return v1.major - v2.major;
        if (v1.minor !== v2.minor) return v1.minor - v2.minor;
        return v1.patch - v2.patch;
    }

    /**
     * Check if version is in range [min, max]
     */
    static isInRange(version: string, minVersion: string, maxVersion?: string): boolean {
        const isAboveMin = this.compareVersions(version, minVersion) >= 0;
        if (!maxVersion) return isAboveMin;
        
        const isBelowMax = this.compareVersions(version, maxVersion) <= 0;
        return isAboveMin && isBelowMax;
    }

    /**
     * Check if migration should run based on version range
     */
    static shouldRunMigration(
        fromVersion: string, 
        toVersion: string, 
        migrationFromVersion: string,
        migrationToVersion?: string
    ): boolean {
        // Migration needed if user's old version is >= migration's target range
        // and user's new version is >= migration's target version
        
        const userFrom = this.parseVersion(fromVersion);
        const userTo = this.parseVersion(toVersion);
        const migrationFrom = this.parseVersion(migrationFromVersion);
        const migrationTo = migrationToVersion ? this.parseVersion(migrationToVersion) : userTo;

        // User was in the range that needs this migration
        const wasInRange = this.compareVersions(fromVersion, migrationFromVersion) >= 0;
        
        // User is upgrading to a version that has this migration
        const isUpgradingTo = this.compareVersions(toVersion, migrationTo.original) >= 0;

        return wasInRange && isUpgradingTo;
    }

    /**
     * Get all versions between two versions (for sequential migrations)
     */
    static getVersionsInRange(fromVersion: string, toVersion: string, availableVersions: string[]): string[] {
        return availableVersions
            .filter(v => 
                this.compareVersions(v, fromVersion) > 0 && 
                this.compareVersions(v, toVersion) <= 0
            )
            .sort((a, b) => this.compareVersions(a, b));
    }

    /**
     * Format version for display
     */
    static formatVersion(version: string): string {
        const parsed = this.parseVersion(version);
        return `v${parsed.major}.${parsed.minor}.${parsed.patch}`;
    }
}