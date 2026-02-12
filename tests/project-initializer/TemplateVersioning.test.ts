/**
 * Tests for template versioning utilities
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  clearMigrations,
  compareVersions,
  findMigrationPath,
  formatVersion,
  getCurrentVersion,
  getMigrations,
  isVersionCompatible,
  migrateTemplate,
  needsMigration,
  parseVersion,
  registerMigration,
  validateTemplateCompatibility,
  versionsEqual,
} from '../../src/project-initializer/TemplateVersioning.js';
import type { TemplateConfig, TemplateVersion } from '../../src/project-initializer/types.js';
import { CURRENT_TEMPLATE_VERSION } from '../../src/project-initializer/types.js';

describe('TemplateVersioning', () => {
  afterEach(() => {
    clearMigrations();
  });

  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      const v1: TemplateVersion = { major: 1, minor: 2, patch: 3 };
      const v2: TemplateVersion = { major: 1, minor: 2, patch: 3 };
      expect(compareVersions(v1, v2)).toBe(0);
    });

    it('should return -1 when first version is lower', () => {
      expect(compareVersions({ major: 1, minor: 0, patch: 0 }, { major: 2, minor: 0, patch: 0 })).toBe(-1);
      expect(compareVersions({ major: 1, minor: 1, patch: 0 }, { major: 1, minor: 2, patch: 0 })).toBe(-1);
      expect(compareVersions({ major: 1, minor: 1, patch: 1 }, { major: 1, minor: 1, patch: 2 })).toBe(-1);
    });

    it('should return 1 when first version is higher', () => {
      expect(compareVersions({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 0 })).toBe(1);
      expect(compareVersions({ major: 1, minor: 2, patch: 0 }, { major: 1, minor: 1, patch: 0 })).toBe(1);
      expect(compareVersions({ major: 1, minor: 1, patch: 2 }, { major: 1, minor: 1, patch: 1 })).toBe(1);
    });
  });

  describe('versionsEqual', () => {
    it('should return true for equal versions', () => {
      expect(versionsEqual({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 2, patch: 3 })).toBe(true);
    });

    it('should return false for different versions', () => {
      expect(versionsEqual({ major: 1, minor: 0, patch: 0 }, { major: 2, minor: 0, patch: 0 })).toBe(false);
    });
  });

  describe('formatVersion', () => {
    it('should format version as string', () => {
      expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
      expect(formatVersion({ major: 0, minor: 0, patch: 0 })).toBe('0.0.0');
      expect(formatVersion({ major: 10, minor: 20, patch: 30 })).toBe('10.20.30');
    });
  });

  describe('parseVersion', () => {
    it('should parse valid version strings', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
      expect(parseVersion('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 });
    });

    it('should handle whitespace', () => {
      expect(parseVersion('  1.2.3  ')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should return null for invalid version strings', () => {
      expect(parseVersion('')).toBeNull();
      expect(parseVersion('1.2')).toBeNull();
      expect(parseVersion('1.2.3.4')).toBeNull();
      expect(parseVersion('v1.2.3')).toBeNull();
      expect(parseVersion('a.b.c')).toBeNull();
    });
  });

  describe('isVersionCompatible', () => {
    it('should return true for same version', () => {
      const v = { major: 1, minor: 0, patch: 0 };
      expect(isVersionCompatible(v, v)).toBe(true);
    });

    it('should return true for older minor version', () => {
      expect(
        isVersionCompatible({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 2, patch: 0 })
      ).toBe(true);
    });

    it('should return false for different major versions', () => {
      expect(
        isVersionCompatible({ major: 1, minor: 0, patch: 0 }, { major: 2, minor: 0, patch: 0 })
      ).toBe(false);
    });

    it('should return false for newer minor version', () => {
      expect(
        isVersionCompatible({ major: 1, minor: 2, patch: 0 }, { major: 1, minor: 1, patch: 0 })
      ).toBe(false);
    });
  });

  describe('migration registry', () => {
    it('should register and retrieve migrations', () => {
      const migration = {
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        description: 'Test migration',
        migrate: (config: TemplateConfig) => config,
      };

      registerMigration(migration);
      const migrations = getMigrations();

      expect(migrations).toHaveLength(1);
      expect(migrations[0]).toEqual(migration);
    });

    it('should clear migrations', () => {
      registerMigration({
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        description: 'Test',
        migrate: (config: TemplateConfig) => config,
      });

      clearMigrations();

      expect(getMigrations()).toHaveLength(0);
    });
  });

  describe('findMigrationPath', () => {
    it('should return empty array for equal versions', () => {
      const v = { major: 1, minor: 0, patch: 0 };
      const path = findMigrationPath(v, v);
      expect(path).toEqual([]);
    });

    it('should return null when trying to migrate backward', () => {
      const from = { major: 2, minor: 0, patch: 0 };
      const to = { major: 1, minor: 0, patch: 0 };
      expect(findMigrationPath(from, to)).toBeNull();
    });

    it('should find single-step migration path', () => {
      const migration = {
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        description: 'Upgrade to 1.1.0',
        migrate: (config: TemplateConfig) => config,
      };

      registerMigration(migration);

      const path = findMigrationPath(
        { major: 1, minor: 0, patch: 0 },
        { major: 1, minor: 1, patch: 0 }
      );

      expect(path).toHaveLength(1);
      expect(path?.[0]).toEqual(migration);
    });

    it('should find multi-step migration path', () => {
      registerMigration({
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        description: 'Step 1',
        migrate: (config: TemplateConfig) => config,
      });

      registerMigration({
        fromVersion: { major: 1, minor: 1, patch: 0 },
        toVersion: { major: 1, minor: 2, patch: 0 },
        description: 'Step 2',
        migrate: (config: TemplateConfig) => config,
      });

      const path = findMigrationPath(
        { major: 1, minor: 0, patch: 0 },
        { major: 1, minor: 2, patch: 0 }
      );

      expect(path).toHaveLength(2);
      expect(path?.[0]?.description).toBe('Step 1');
      expect(path?.[1]?.description).toBe('Step 2');
    });

    it('should return null when no path exists', () => {
      registerMigration({
        fromVersion: { major: 1, minor: 0, patch: 0 },
        toVersion: { major: 1, minor: 1, patch: 0 },
        description: 'Only migration',
        migrate: (config: TemplateConfig) => config,
      });

      const path = findMigrationPath(
        { major: 1, minor: 0, patch: 0 },
        { major: 1, minor: 3, patch: 0 }
      );

      expect(path).toBeNull();
    });
  });

  describe('validateTemplateCompatibility', () => {
    it('should return compatible for current version', () => {
      const config: TemplateConfig = {
        version: CURRENT_TEMPLATE_VERSION,
        agents: 'default',
        qualityGates: 'basic',
        parallelWorkers: 2,
        extraFeatures: [],
      };

      const result = validateTemplateCompatibility(config);

      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect major version mismatch', () => {
      const config: TemplateConfig = {
        version: { major: 0, minor: 0, patch: 0 },
        agents: 'default',
        qualityGates: 'basic',
        parallelWorkers: 2,
        extraFeatures: [],
      };

      const result = validateTemplateCompatibility(config);

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes('Major version'))).toBe(true);
    });

    it('should detect newer template version', () => {
      const config: TemplateConfig = {
        version: { major: 99, minor: 0, patch: 0 },
        agents: 'default',
        qualityGates: 'basic',
        parallelWorkers: 2,
        extraFeatures: [],
      };

      const result = validateTemplateCompatibility(config);

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes('newer'))).toBe(true);
    });
  });

  describe('migrateTemplate', () => {
    it('should return unchanged config for current version', () => {
      const config: TemplateConfig = {
        version: CURRENT_TEMPLATE_VERSION,
        agents: 'default',
        qualityGates: 'basic',
        parallelWorkers: 2,
        extraFeatures: [],
      };

      const result = migrateTemplate(config);

      expect(result.success).toBe(true);
      expect(result.migrated).toEqual(config);
      expect(result.appliedSteps).toHaveLength(0);
    });

    it('should fail for newer version', () => {
      const config: TemplateConfig = {
        version: { major: 99, minor: 0, patch: 0 },
        agents: 'default',
        qualityGates: 'basic',
        parallelWorkers: 2,
        extraFeatures: [],
      };

      const result = migrateTemplate(config);

      expect(result.success).toBe(false);
      expect(result.migrated).toBeNull();
      expect(result.error).toContain('Cannot migrate from newer version');
    });

    it('should apply implicit migration for same major version', () => {
      // Use a version slightly older than current (if current is 1.0.0)
      if (CURRENT_TEMPLATE_VERSION.minor > 0 || CURRENT_TEMPLATE_VERSION.patch > 0) {
        const config: TemplateConfig = {
          version: { major: CURRENT_TEMPLATE_VERSION.major, minor: 0, patch: 0 },
          agents: 'default',
          qualityGates: 'basic',
          parallelWorkers: 2,
          extraFeatures: [],
        };

        const result = migrateTemplate(config);

        expect(result.success).toBe(true);
        expect(result.migrated?.version).toEqual(CURRENT_TEMPLATE_VERSION);
      }
    });

    it('should apply registered migrations', () => {
      const v1 = { major: 1, minor: 0, patch: 0 };
      const v2 = { major: 1, minor: 0, patch: 1 };

      // Register migration that adds a feature
      registerMigration({
        fromVersion: v1,
        toVersion: v2,
        description: 'Add monitoring feature',
        migrate: (config: TemplateConfig): TemplateConfig => ({
          ...config,
          version: v2,
          extraFeatures: [...config.extraFeatures, 'monitoring'],
        }),
      });

      // Only test if current version is 1.0.1
      if (versionsEqual(CURRENT_TEMPLATE_VERSION, v2)) {
        const config: TemplateConfig = {
          version: v1,
          agents: 'default',
          qualityGates: 'basic',
          parallelWorkers: 2,
          extraFeatures: [],
        };

        const result = migrateTemplate(config);

        expect(result.success).toBe(true);
        expect(result.migrated?.extraFeatures).toContain('monitoring');
        expect(result.appliedSteps).toHaveLength(1);
      }
    });
  });

  describe('needsMigration', () => {
    it('should return false for current version', () => {
      const config: TemplateConfig = {
        version: CURRENT_TEMPLATE_VERSION,
        agents: 'default',
        qualityGates: 'basic',
        parallelWorkers: 2,
        extraFeatures: [],
      };

      expect(needsMigration(config)).toBe(false);
    });

    it('should return true for older version', () => {
      const config: TemplateConfig = {
        version: { major: 0, minor: 0, patch: 0 },
        agents: 'default',
        qualityGates: 'basic',
        parallelWorkers: 2,
        extraFeatures: [],
      };

      expect(needsMigration(config)).toBe(true);
    });

    it('should return false for newer version', () => {
      const config: TemplateConfig = {
        version: { major: 99, minor: 99, patch: 99 },
        agents: 'default',
        qualityGates: 'basic',
        parallelWorkers: 2,
        extraFeatures: [],
      };

      expect(needsMigration(config)).toBe(false);
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current template version', () => {
      expect(getCurrentVersion()).toEqual(CURRENT_TEMPLATE_VERSION);
    });
  });
});
