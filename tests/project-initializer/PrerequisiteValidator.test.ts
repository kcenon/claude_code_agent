/**
 * Tests for PrerequisiteValidator
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPrerequisiteValidator,
  PrerequisiteValidator,
  resetPrerequisiteValidator,
} from '../../src/project-initializer/PrerequisiteValidator.js';

describe('PrerequisiteValidator', () => {
  beforeEach(() => {
    resetPrerequisiteValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with default checks', () => {
      const validator = new PrerequisiteValidator();
      const checks = validator.getChecks();

      expect(checks.length).toBeGreaterThan(0);
      expect(checks.some((c) => c.name === 'Node.js Version')).toBe(true);
      expect(checks.some((c) => c.name === 'Claude API Key')).toBe(true);
      expect(checks.some((c) => c.name === 'GitHub CLI')).toBe(true);
      expect(checks.some((c) => c.name === 'Git')).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return valid result when required checks pass', async () => {
      const validator = new PrerequisiteValidator();
      const result = await validator.validate();

      // Node.js version should pass in test environment
      expect(result.checks.some((c) => c.name === 'Node.js Version' && c.passed)).toBe(true);
    });

    it('should mark optional check failures as warnings', async () => {
      const validator = new PrerequisiteValidator();
      const result = await validator.validate();

      // Claude API Key is optional and may not be set in test environment
      const claudeCheck = result.checks.find((c) => c.name === 'Claude API Key');
      expect(claudeCheck).toBeDefined();
      expect(claudeCheck?.required).toBe(false);
    });

    it('should include fix instructions for failed checks', async () => {
      const validator = new PrerequisiteValidator();
      const result = await validator.validate();

      for (const check of result.checks) {
        if (!check.passed) {
          expect(check.fix).toBeDefined();
          expect(typeof check.fix).toBe('string');
        }
      }
    });
  });

  describe('addCheck', () => {
    it('should allow adding custom checks', async () => {
      const validator = new PrerequisiteValidator();
      validator.addCheck({
        name: 'Custom Check',
        check: async () => true,
        fix: 'No fix needed',
        required: false,
      });

      const checks = validator.getChecks();
      expect(checks.some((c) => c.name === 'Custom Check')).toBe(true);

      const result = await validator.validate();
      const customCheck = result.checks.find((c) => c.name === 'Custom Check');
      expect(customCheck?.passed).toBe(true);
    });

    it('should handle custom check failures', async () => {
      const validator = new PrerequisiteValidator();
      validator.addCheck({
        name: 'Failing Check',
        check: async () => false,
        fix: 'This is the fix',
        required: false,
      });

      const result = await validator.validate();
      const failingCheck = result.checks.find((c) => c.name === 'Failing Check');
      expect(failingCheck?.passed).toBe(false);
      expect(failingCheck?.fix).toBe('This is the fix');
    });
  });

  describe('getPrerequisiteValidator', () => {
    it('should return singleton instance', () => {
      const instance1 = getPrerequisiteValidator();
      const instance2 = getPrerequisiteValidator();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = getPrerequisiteValidator();
      resetPrerequisiteValidator();
      const instance2 = getPrerequisiteValidator();
      expect(instance1).not.toBe(instance2);
    });
  });
});
