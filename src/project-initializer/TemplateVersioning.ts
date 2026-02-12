/**
 * Template versioning utilities for migration and compatibility checking
 *
 * @packageDocumentation
 */

import {
  CURRENT_TEMPLATE_VERSION,
  type TemplateCompatibilityResult,
  type TemplateConfig,
  type TemplateMigrationResult,
  type TemplateMigrationStep,
  type TemplateVersion,
} from './types.js';

/**
 * Compare two template versions
 *
 * @param a - First version to compare
 * @param b - Second version to compare
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: TemplateVersion, b: TemplateVersion): -1 | 0 | 1 {
  if (a.major !== b.major) {
    return a.major < b.major ? -1 : 1;
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor ? -1 : 1;
  }
  if (a.patch !== b.patch) {
    return a.patch < b.patch ? -1 : 1;
  }
  return 0;
}

/**
 * Check if two versions are equal
 */
export function versionsEqual(a: TemplateVersion, b: TemplateVersion): boolean {
  return compareVersions(a, b) === 0;
}

/**
 * Format a version as a string (e.g., "1.0.0")
 */
export function formatVersion(version: TemplateVersion): string {
  return `${String(version.major)}.${String(version.minor)}.${String(version.patch)}`;
}

/**
 * Parse a version string (e.g., "1.0.0") into a TemplateVersion
 *
 * @param versionString - Version string to parse
 * @returns Parsed version or null if invalid
 */
export function parseVersion(versionString: string): TemplateVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(versionString.trim());
  if (match === null || match.length < 4) {
    return null;
  }
  const [, majorStr, minorStr, patchStr] = match;
  if (majorStr === undefined || minorStr === undefined || patchStr === undefined) {
    return null;
  }
  return {
    major: parseInt(majorStr, 10),
    minor: parseInt(minorStr, 10),
    patch: parseInt(patchStr, 10),
  };
}

/**
 * Check if source version is compatible with target version.
 * Versions are compatible if:
 * - Major versions match (breaking changes require migration)
 * - Source minor version <= target minor version
 */
export function isVersionCompatible(source: TemplateVersion, target: TemplateVersion): boolean {
  // Major version must match for compatibility
  if (source.major !== target.major) {
    return false;
  }
  // Source can be older or same minor version
  return source.minor <= target.minor;
}

/**
 * Registry of available migrations
 */
const migrationRegistry: TemplateMigrationStep[] = [];

/**
 * Register a migration step
 */
export function registerMigration(step: TemplateMigrationStep): void {
  migrationRegistry.push(step);
}

/**
 * Clear all registered migrations (for testing)
 */
export function clearMigrations(): void {
  migrationRegistry.length = 0;
}

/**
 * Get all registered migrations
 */
export function getMigrations(): readonly TemplateMigrationStep[] {
  return [...migrationRegistry];
}

/**
 * Find migration path between two versions
 *
 * @param from - Starting version
 * @param to - Target version
 * @returns Array of migrations to apply, or null if no path exists
 */
export function findMigrationPath(
  from: TemplateVersion,
  to: TemplateVersion
): readonly TemplateMigrationStep[] | null {
  // If versions are equal, no migration needed
  if (versionsEqual(from, to)) {
    return [];
  }

  // Can only migrate forward
  if (compareVersions(from, to) > 0) {
    return null;
  }

  // Find path using BFS
  const queue: Array<{ version: TemplateVersion; path: TemplateMigrationStep[] }> = [
    { version: from, path: [] },
  ];
  const visited = new Set<string>();
  visited.add(formatVersion(from));

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }

    // Find applicable migrations from current version
    for (const migration of migrationRegistry) {
      if (!versionsEqual(migration.fromVersion, current.version)) {
        continue;
      }

      const nextVersion = migration.toVersion;
      const versionKey = formatVersion(nextVersion);

      if (visited.has(versionKey)) {
        continue;
      }

      const newPath = [...current.path, migration];

      // Check if we reached the target
      if (versionsEqual(nextVersion, to)) {
        return newPath;
      }

      // Continue searching if not past target
      if (compareVersions(nextVersion, to) < 0) {
        visited.add(versionKey);
        queue.push({ version: nextVersion, path: newPath });
      }
    }
  }

  return null;
}

/**
 * Validate template compatibility against current version
 *
 * @param config - Template configuration to validate
 * @returns Compatibility result
 */
export function validateTemplateCompatibility(config: TemplateConfig): TemplateCompatibilityResult {
  const sourceVersion = config.version;
  const targetVersion = CURRENT_TEMPLATE_VERSION;

  const issues: string[] = [];
  const requiredMigrations: string[] = [];

  // Check major version compatibility
  if (sourceVersion.major !== targetVersion.major) {
    issues.push(
      `Major version mismatch: template is v${String(sourceVersion.major)}.x, ` +
        `current is v${String(targetVersion.major)}.x`
    );
  }

  // Check if source is newer than target (future version)
  if (compareVersions(sourceVersion, targetVersion) > 0) {
    issues.push(
      `Template version ${formatVersion(sourceVersion)} is newer than ` +
        `current version ${formatVersion(targetVersion)}`
    );
  }

  // Find migration path if needed
  let canMigrate = false;
  if (compareVersions(sourceVersion, targetVersion) < 0) {
    const migrationPath = findMigrationPath(sourceVersion, targetVersion);
    if (migrationPath !== null) {
      canMigrate = true;
      for (const step of migrationPath) {
        requiredMigrations.push(
          `${formatVersion(step.fromVersion)} -> ${formatVersion(step.toVersion)}: ${step.description}`
        );
      }
    } else if (sourceVersion.major === targetVersion.major) {
      // Same major version but no explicit migration - may still be compatible
      canMigrate = true;
    }
  }

  const compatible =
    issues.length === 0 || (isVersionCompatible(sourceVersion, targetVersion) && canMigrate);

  return {
    compatible,
    sourceVersion,
    targetVersion,
    issues,
    canMigrate,
    requiredMigrations,
  };
}

/**
 * Migrate a template configuration to the current version
 *
 * @param config - Template configuration to migrate
 * @returns Migration result
 */
export function migrateTemplate(config: TemplateConfig): TemplateMigrationResult {
  const sourceVersion = config.version;
  const targetVersion = CURRENT_TEMPLATE_VERSION;

  // No migration needed if already at target
  if (versionsEqual(sourceVersion, targetVersion)) {
    return {
      success: true,
      original: config,
      migrated: config,
      appliedSteps: [],
    };
  }

  // Cannot migrate forward (newer to older)
  if (compareVersions(sourceVersion, targetVersion) > 0) {
    return {
      success: false,
      original: config,
      migrated: null,
      appliedSteps: [],
      error:
        `Cannot migrate from newer version ${formatVersion(sourceVersion)} ` +
        `to older version ${formatVersion(targetVersion)}`,
    };
  }

  // Find migration path
  const migrationPath = findMigrationPath(sourceVersion, targetVersion);

  if (migrationPath === null || migrationPath.length === 0) {
    // No explicit migrations, but if same major version, just update version
    if (sourceVersion.major === targetVersion.major) {
      return {
        success: true,
        original: config,
        migrated: {
          ...config,
          version: targetVersion,
        },
        appliedSteps: ['Implicit version update (same major version)'],
      };
    }

    return {
      success: false,
      original: config,
      migrated: null,
      appliedSteps: [],
      error:
        `No migration path found from ${formatVersion(sourceVersion)} ` +
        `to ${formatVersion(targetVersion)}`,
    };
  }

  // Apply migrations in sequence
  const appliedSteps: string[] = [];
  let currentConfig = config;

  try {
    for (const step of migrationPath) {
      currentConfig = step.migrate(currentConfig);
      appliedSteps.push(
        `${formatVersion(step.fromVersion)} -> ${formatVersion(step.toVersion)}: ${step.description}`
      );
    }

    return {
      success: true,
      original: config,
      migrated: currentConfig,
      appliedSteps,
    };
  } catch (error) {
    return {
      success: false,
      original: config,
      migrated: null,
      appliedSteps,
      error: error instanceof Error ? error.message : 'Unknown migration error',
    };
  }
}

/**
 * Check if a template configuration needs migration
 */
export function needsMigration(config: TemplateConfig): boolean {
  return compareVersions(config.version, CURRENT_TEMPLATE_VERSION) < 0;
}

/**
 * Get the current template version
 */
export function getCurrentVersion(): TemplateVersion {
  return CURRENT_TEMPLATE_VERSION;
}
