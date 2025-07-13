// src/upgrade/upgrade-registry.ts
import { BaseMigration } from "./migrations/migration-interface";
import { VersionUtils } from "./utils/version-utils";
import { Logger } from "../logger";

const logger = new Logger();

export class UpgradeRegistry {
    private migrations: Map<string, BaseMigration> = new Map();

    /**
     * Register a migration
     */
    register(migration: BaseMigration): void {
        if (this.migrations.has(migration.id)) {
            logger.warn(`Migration ${migration.id} is already registered`);
            return;
        }

        this.migrations.set(migration.id, migration);
        logger.info(`Registered migration: ${migration.id} (${migration.name})`);
    }

    /**
     * Get all registered migrations
     */
    getAllMigrations(): BaseMigration[] {
        return Array.from(this.migrations.values());
    }

    /**
     * Get migration by ID
     */
    getMigration(id: string): BaseMigration | undefined {
        return this.migrations.get(id);
    }

    /**
     * Get migrations that should run for the given version upgrade
     */
    getMigrationsForUpgrade(fromVersion: string, toVersion: string): BaseMigration[] {
        const applicableMigrations = Array.from(this.migrations.values())
            .filter(migration => migration.shouldRun(fromVersion, toVersion))
            .sort((a, b) => {
                // Sort by target version (earliest first)
                return VersionUtils.compareVersions(a.toVersion, b.toVersion);
            });

        logger.info(
            `Found ${applicableMigrations.length} migrations for upgrade ${fromVersion} → ${toVersion}:`,
            applicableMigrations.map(m => m.id)
        );

        return applicableMigrations;
    }

    /**
     * Get migrations by version range
     */
    getMigrationsByVersionRange(minVersion: string, maxVersion?: string): BaseMigration[] {
        return Array.from(this.migrations.values())
            .filter(migration => {
                if (maxVersion) {
                    return VersionUtils.isInRange(migration.fromVersion, minVersion, maxVersion);
                } else {
                    return VersionUtils.compareVersions(migration.fromVersion, minVersion) >= 0;
                }
            })
            .sort((a, b) => VersionUtils.compareVersions(a.toVersion, b.toVersion));
    }

    /**
     * Check if any migrations are available for the upgrade
     */
    hasMigrationsForUpgrade(fromVersion: string, toVersion: string): boolean {
        return this.getMigrationsForUpgrade(fromVersion, toVersion).length > 0;
    }

    /**
     * Get statistics about registered migrations
     */
    getStats(): {
        total: number;
        byVersion: Record<string, number>;
        versions: string[];
    } {
        const migrations = Array.from(this.migrations.values());
        const byVersion: Record<string, number> = {};
        const versions = new Set<string>();

        migrations.forEach(migration => {
            const version = migration.toVersion;
            byVersion[version] = (byVersion[version] || 0) + 1;
            versions.add(migration.fromVersion);
            versions.add(migration.toVersion);
        });

        return {
            total: migrations.length,
            byVersion,
            versions: Array.from(versions).sort((a, b) => VersionUtils.compareVersions(a, b))
        };
    }

    /**
     * Validate all registered migrations
     */
    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const migrations = Array.from(this.migrations.values());

        // Check for duplicate IDs (already handled in register, but double-check)
        const ids = migrations.map(m => m.id);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            errors.push(`Duplicate migration IDs: ${duplicateIds.join(", ")}`);
        }

        // Check version format
        migrations.forEach(migration => {
            try {
                VersionUtils.parseVersion(migration.fromVersion);
                VersionUtils.parseVersion(migration.toVersion);
            } catch (error) {
                errors.push(`Invalid version format in migration ${migration.id}: ${error}`);
            }

            // Check logical version order
            if (VersionUtils.compareVersions(migration.fromVersion, migration.toVersion) > 0) {
                errors.push(`Migration ${migration.id}: fromVersion (${migration.fromVersion}) is newer than toVersion (${migration.toVersion})`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Clear all registered migrations (for testing)
     */
    clear(): void {
        this.migrations.clear();
        logger.info("Cleared all registered migrations");
    }
}