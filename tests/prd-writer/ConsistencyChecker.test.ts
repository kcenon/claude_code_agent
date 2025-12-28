import { describe, it, expect } from 'vitest';
import { ConsistencyChecker } from '../../src/prd-writer/ConsistencyChecker.js';
import type { CollectedInfo } from '../../src/scratchpad/index.js';

describe('ConsistencyChecker', () => {
  const createMinimalCollectedInfo = (
    overrides: Partial<CollectedInfo> = {}
  ): CollectedInfo => ({
    schemaVersion: '1.0.0',
    projectId: '001',
    status: 'completed',
    project: {
      name: 'Test Project',
      description: 'A comprehensive test project for validation purposes',
    },
    requirements: {
      functional: [],
      nonFunctional: [],
    },
    constraints: [],
    assumptions: [],
    dependencies: [],
    clarifications: [],
    sources: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create checker with default options', () => {
      const checker = new ConsistencyChecker();
      expect(checker).toBeDefined();
    });

    it('should create checker with custom options', () => {
      const checker = new ConsistencyChecker({
        maxP0Percentage: 50,
        minLowPriorityPercentage: 10,
        checkBidirectionalDeps: false,
        duplicateSimilarityThreshold: 0.9,
      });
      expect(checker).toBeDefined();
    });
  });

  describe('check', () => {
    it('should return consistency check result', () => {
      const checker = new ConsistencyChecker();
      const info = createMinimalCollectedInfo();

      const result = checker.check(info);

      expect(result).toBeDefined();
      expect(typeof result.isConsistent).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(result.priorityDistribution).toBeDefined();
      expect(result.dependencyAnalysis).toBeDefined();
    });

    it('should be consistent with empty requirements', () => {
      const checker = new ConsistencyChecker();
      const info = createMinimalCollectedInfo();

      const result = checker.check(info);

      expect(result.isConsistent).toBe(true);
    });

    it('should detect unbalanced priorities with too many P0s', () => {
      const checker = new ConsistencyChecker({ maxP0Percentage: 30 });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Feature 1',
              description: 'First feature',
              priority: 'P0',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-002',
              title: 'Feature 2',
              description: 'Second feature',
              priority: 'P0',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-003',
              title: 'Feature 3',
              description: 'Third feature',
              priority: 'P0',
              acceptanceCriteria: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      expect(result.priorityDistribution.isBalanced).toBe(false);
      expect(result.priorityDistribution.recommendation).toContain('P0');
    });

    it('should detect unbalanced priorities with too few low priority items', () => {
      const checker = new ConsistencyChecker({ minLowPriorityPercentage: 20 });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Feature 1',
              description: 'First feature',
              priority: 'P0',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-002',
              title: 'Feature 2',
              description: 'Second feature',
              priority: 'P1',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-003',
              title: 'Feature 3',
              description: 'Third feature',
              priority: 'P1',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-004',
              title: 'Feature 4',
              description: 'Fourth feature',
              priority: 'P1',
              acceptanceCriteria: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      // With 4 requirements and 0 P2/P3, the low priority percentage is 0%
      // which is less than the required 20%, so it should be unbalanced
      expect(result.priorityDistribution.isBalanced).toBe(false);
      expect(result.priorityDistribution.recommendation).toContain('P2/P3');
    });

    it('should detect duplicate requirements by title', () => {
      const checker = new ConsistencyChecker({ duplicateSimilarityThreshold: 0.8 });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'User Authentication System',
              description: 'Allow users to log in',
              priority: 'P0',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-002',
              title: 'User Authentication System',
              description: 'Enable secure login for users',
              priority: 'P1',
              acceptanceCriteria: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      const hasDuplicateIssue = result.issues.some(
        (i) => i.type === 'duplicate_requirement'
      );
      expect(hasDuplicateIssue).toBe(true);
    });

    it('should detect duplicate requirements by description', () => {
      const checker = new ConsistencyChecker({ duplicateSimilarityThreshold: 0.8 });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Login',
              description: 'Users must be able to authenticate using email and password',
              priority: 'P0',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-002',
              title: 'Auth',
              description: 'Users must be able to authenticate using email and password',
              priority: 'P1',
              acceptanceCriteria: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      const hasDuplicateIssue = result.issues.some(
        (i) => i.type === 'duplicate_requirement'
      );
      expect(hasDuplicateIssue).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const checker = new ConsistencyChecker();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Feature A',
              description: 'First feature',
              priority: 'P0',
              acceptanceCriteria: [],
              dependencies: ['FR-002'],
            },
            {
              id: 'FR-002',
              title: 'Feature B',
              description: 'Second feature',
              priority: 'P1',
              acceptanceCriteria: [],
              dependencies: ['FR-003'],
            },
            {
              id: 'FR-003',
              title: 'Feature C',
              description: 'Third feature',
              priority: 'P2',
              acceptanceCriteria: [],
              dependencies: ['FR-001'],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      expect(result.dependencyAnalysis.circularChains.length).toBeGreaterThan(0);
      const hasCircularIssue = result.issues.some(
        (i) => i.type === 'circular_dependency'
      );
      expect(hasCircularIssue).toBe(true);
    });

    it('should detect missing bidirectional dependencies', () => {
      const checker = new ConsistencyChecker({ checkBidirectionalDeps: true });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Feature A',
              description: 'First feature',
              priority: 'P0',
              acceptanceCriteria: [],
              dependencies: ['FR-002'],
            },
            {
              id: 'FR-002',
              title: 'Feature B',
              description: 'Second feature',
              priority: 'P1',
              acceptanceCriteria: [],
              dependencies: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      expect(result.dependencyAnalysis.missingBidirectional.length).toBeGreaterThan(0);
      const hasMissingBiDep = result.issues.some(
        (i) => i.type === 'missing_bidirectional_dependency'
      );
      expect(hasMissingBiDep).toBe(true);
    });

    it('should not check bidirectional dependencies when disabled', () => {
      const checker = new ConsistencyChecker({ checkBidirectionalDeps: false });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Feature A',
              description: 'First feature',
              priority: 'P0',
              acceptanceCriteria: [],
              dependencies: ['FR-002'],
            },
            {
              id: 'FR-002',
              title: 'Feature B',
              description: 'Second feature',
              priority: 'P1',
              acceptanceCriteria: [],
              dependencies: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      const hasMissingBiDep = result.issues.some(
        (i) => i.type === 'missing_bidirectional_dependency'
      );
      expect(hasMissingBiDep).toBe(false);
    });

    it('should detect potential conflicts between performance and security NFRs', () => {
      const checker = new ConsistencyChecker();
      // The conflict detection checks if:
      // - perf.description contains ['encryption', 'logging', 'audit']
      // - AND sec.description contains ['fast', 'minimal', 'overhead']
      // This represents perf concerns about heavy security ops AND security concerns about performance impacts
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Fast Response',
              description: 'System must be fast despite encryption and logging overhead',
              priority: 'P0',
            },
            {
              id: 'NFR-002',
              category: 'security',
              title: 'Encryption',
              description: 'All data must be encrypted with minimal performance overhead',
              priority: 'P0',
            },
          ],
        },
      });

      const result = checker.check(info);

      const hasConflictIssue = result.issues.some(
        (i) => i.type === 'conflicting_requirements'
      );
      expect(hasConflictIssue).toBe(true);
    });

    it('should detect contradictory functional requirements', () => {
      const checker = new ConsistencyChecker();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Enable Logging',
              description: 'System must always log user actions to the database',
              priority: 'P0',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-002',
              title: 'Disable Logging',
              description: 'System must never log user actions to the database',
              priority: 'P1',
              acceptanceCriteria: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      const hasConflictIssue = result.issues.some(
        (i) => i.type === 'conflicting_requirements'
      );
      expect(hasConflictIssue).toBe(true);
    });

    it('should count total dependencies correctly', () => {
      const checker = new ConsistencyChecker();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Feature A',
              description: 'First feature',
              priority: 'P0',
              acceptanceCriteria: [],
              dependencies: ['FR-002', 'FR-003'],
            },
            {
              id: 'FR-002',
              title: 'Feature B',
              description: 'Second feature',
              priority: 'P1',
              acceptanceCriteria: [],
              dependencies: ['FR-003'],
            },
            {
              id: 'FR-003',
              title: 'Feature C',
              description: 'Third feature',
              priority: 'P2',
              acceptanceCriteria: [],
              dependencies: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      expect(result.dependencyAnalysis.totalDependencies).toBe(3);
    });

    it('should generate unique issue IDs', () => {
      const checker = new ConsistencyChecker({ duplicateSimilarityThreshold: 0.8 });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'User Login',
              description: 'Allow users to log in',
              priority: 'P0',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-002',
              title: 'User Login',
              description: 'Enable user login',
              priority: 'P1',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-003',
              title: 'User Login',
              description: 'User login feature',
              priority: 'P2',
              acceptanceCriteria: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      const ids = result.issues.map((i) => i.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should handle balanced priority distribution', () => {
      const checker = new ConsistencyChecker();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Feature 1',
              description: 'First feature',
              priority: 'P0',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-002',
              title: 'Feature 2',
              description: 'Second feature',
              priority: 'P1',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-003',
              title: 'Feature 3',
              description: 'Third feature',
              priority: 'P2',
              acceptanceCriteria: [],
            },
            {
              id: 'FR-004',
              title: 'Feature 4',
              description: 'Fourth feature',
              priority: 'P3',
              acceptanceCriteria: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = checker.check(info);

      expect(result.priorityDistribution.isBalanced).toBe(true);
      expect(result.priorityDistribution.p0Count).toBe(1);
      expect(result.priorityDistribution.p1Count).toBe(1);
      expect(result.priorityDistribution.p2Count).toBe(1);
      expect(result.priorityDistribution.p3Count).toBe(1);
    });
  });
});
