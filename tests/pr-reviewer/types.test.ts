import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PR_REVIEWER_CONFIG,
  DEFAULT_QUALITY_GATE_CONFIG,
} from '../../src/pr-reviewer/types.js';

describe('types', () => {
  describe('DEFAULT_PR_REVIEWER_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_PR_REVIEWER_CONFIG.projectRoot).toBe(process.cwd());
      expect(DEFAULT_PR_REVIEWER_CONFIG.resultsPath).toBe('.ad-sdlc/scratchpad/progress');
      expect(DEFAULT_PR_REVIEWER_CONFIG.autoMerge).toBe(false);
      expect(DEFAULT_PR_REVIEWER_CONFIG.mergeStrategy).toBe('squash');
      expect(DEFAULT_PR_REVIEWER_CONFIG.deleteBranchOnMerge).toBe(true);
      expect(DEFAULT_PR_REVIEWER_CONFIG.coverageThreshold).toBe(80);
      expect(DEFAULT_PR_REVIEWER_CONFIG.maxComplexity).toBe(10);
      expect(DEFAULT_PR_REVIEWER_CONFIG.ciTimeout).toBe(600000);
      expect(DEFAULT_PR_REVIEWER_CONFIG.ciPollInterval).toBe(10000);
    });

    it('should be defined as const', () => {
      const config = DEFAULT_PR_REVIEWER_CONFIG;
      // const assertion provides compile-time immutability
      expect(config).toBeDefined();
      expect(typeof config.projectRoot).toBe('string');
    });
  });

  describe('DEFAULT_QUALITY_GATE_CONFIG', () => {
    it('should have correct required gates', () => {
      const required = DEFAULT_QUALITY_GATE_CONFIG.required;
      expect(required.testsPass).toBe(true);
      expect(required.buildPass).toBe(true);
      expect(required.lintPass).toBe(true);
      expect(required.noCriticalSecurity).toBe(true);
      expect(required.noCriticalIssues).toBe(true);
      expect(required.codeCoverage).toBe(80);
    });

    it('should have correct recommended gates', () => {
      const recommended = DEFAULT_QUALITY_GATE_CONFIG.recommended;
      expect(recommended.noMajorIssues).toBe(true);
      expect(recommended.newLinesCoverage).toBe(90);
      expect(recommended.maxComplexity).toBe(10);
      expect(recommended.noStyleViolations).toBe(true);
    });

    it('should be defined as const', () => {
      const config = DEFAULT_QUALITY_GATE_CONFIG;
      // const assertion provides compile-time immutability
      expect(config).toBeDefined();
      expect(typeof config.required).toBe('object');
    });
  });
});
