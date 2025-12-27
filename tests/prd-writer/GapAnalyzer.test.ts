import { describe, it, expect } from 'vitest';
import { GapAnalyzer } from '../../src/prd-writer/GapAnalyzer.js';
import type { CollectedInfo } from '../../src/scratchpad/index.js';

describe('GapAnalyzer', () => {
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
    it('should create analyzer with default options', () => {
      const analyzer = new GapAnalyzer();
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with custom options', () => {
      const analyzer = new GapAnalyzer({
        minFunctionalRequirements: 3,
        minAcceptanceCriteria: 2,
      });
      expect(analyzer).toBeDefined();
    });
  });

  describe('analyze', () => {
    it('should return gap analysis result', () => {
      const analyzer = new GapAnalyzer();
      const info = createMinimalCollectedInfo();

      const result = analyzer.analyze(info);

      expect(result).toBeDefined();
      expect(typeof result.totalGaps).toBe('number');
      expect(Array.isArray(result.criticalGaps)).toBe(true);
      expect(Array.isArray(result.majorGaps)).toBe(true);
      expect(Array.isArray(result.minorGaps)).toBe(true);
      expect(Array.isArray(result.infoGaps)).toBe(true);
      expect(typeof result.completenessScore).toBe('number');
    });

    it('should detect missing functional requirements', () => {
      const analyzer = new GapAnalyzer();
      const info = createMinimalCollectedInfo();

      const result = analyzer.analyze(info);

      const hasGapForMissingFR = result.criticalGaps.some(
        (g) => g.category === 'missing_requirement'
      );
      expect(hasGapForMissingFR).toBe(true);
    });

    it('should detect auto-generated project name', () => {
      const analyzer = new GapAnalyzer();
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Project-001',
          description: 'A comprehensive test project',
        },
      });

      const result = analyzer.analyze(info);

      const hasGapForProjectName = result.majorGaps.some(
        (g) =>
          g.category === 'missing_description' &&
          g.section === 'executive_summary'
      );
      expect(hasGapForProjectName).toBe(true);
    });

    it('should detect short project description', () => {
      const analyzer = new GapAnalyzer();
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Test Project',
          description: 'Short',
        },
      });

      const result = analyzer.analyze(info);

      const hasGapForDescription = result.majorGaps.some(
        (g) =>
          g.category === 'missing_description' &&
          g.section === 'executive_summary'
      );
      expect(hasGapForDescription).toBe(true);
    });

    it('should detect missing acceptance criteria', () => {
      const analyzer = new GapAnalyzer();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'User Authentication',
              description: 'System must support user authentication',
              priority: 'P0',
              acceptanceCriteria: [],
              dependencies: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = analyzer.analyze(info);

      const hasGapForAC = result.majorGaps.some(
        (g) =>
          g.category === 'missing_acceptance_criteria' && g.relatedId === 'FR-001'
      );
      expect(hasGapForAC).toBe(true);
    });

    it('should detect missing NFR metrics', () => {
      const analyzer = new GapAnalyzer({ requireNFRMetrics: true });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Test',
              description: 'Test requirement',
              priority: 'P0',
              acceptanceCriteria: [
                { id: 'AC-001', description: 'Works', testable: true },
              ],
            },
          ],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Fast Response',
              description: 'System should respond quickly',
              priority: 'P1',
            },
          ],
        },
      });

      const result = analyzer.analyze(info);

      const hasGapForMetric = result.minorGaps.some(
        (g) => g.category === 'missing_metric' && g.relatedId === 'NFR-001'
      );
      expect(hasGapForMetric).toBe(true);
    });

    it('should not detect missing NFR metrics when disabled', () => {
      const analyzer = new GapAnalyzer({ requireNFRMetrics: false });
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Test',
              description: 'Test requirement',
              priority: 'P0',
              acceptanceCriteria: [
                { id: 'AC-001', description: 'Works', testable: true },
              ],
            },
          ],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Fast Response',
              description: 'System should respond quickly',
              priority: 'P1',
            },
          ],
        },
      });

      const result = analyzer.analyze(info);

      const hasGapForMetric = result.minorGaps.some(
        (g) => g.category === 'missing_metric'
      );
      expect(hasGapForMetric).toBe(false);
    });

    it('should calculate completeness score', () => {
      const analyzer = new GapAnalyzer();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Authentication',
              description: 'User must be able to log in',
              priority: 'P0',
              acceptanceCriteria: [
                { id: 'AC-001', description: 'Login works', testable: true },
              ],
            },
            {
              id: 'FR-002',
              title: 'Profile',
              description: 'User must be able to view profile',
              priority: 'P1',
              acceptanceCriteria: [
                { id: 'AC-002', description: 'Profile loads', testable: true },
              ],
            },
            {
              id: 'FR-003',
              title: 'Settings',
              description: 'User must be able to change settings',
              priority: 'P2',
              acceptanceCriteria: [
                { id: 'AC-003', description: 'Settings save', testable: true },
              ],
            },
          ],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Response Time',
              description: 'Fast',
              priority: 'P1',
              metric: '< 200ms',
            },
            {
              id: 'NFR-002',
              category: 'security',
              title: 'Encryption',
              description: 'Secure',
              priority: 'P0',
              metric: 'AES-256',
            },
          ],
        },
        constraints: [{ id: 'CON-001', description: 'Must use TypeScript', reason: 'Standard' }],
        assumptions: [{ id: 'ASM-001', description: 'Users have internet', validated: false, riskIfWrong: 'App wont work' }],
        dependencies: [{ name: 'node', type: 'tool', required: true, purpose: 'Runtime' }],
      });

      const result = analyzer.analyze(info);

      expect(result.completenessScore).toBeGreaterThan(0);
      expect(result.completenessScore).toBeLessThanOrEqual(1);
    });

    it('should identify sections with gaps', () => {
      const analyzer = new GapAnalyzer();
      const info = createMinimalCollectedInfo();

      const result = analyzer.analyze(info);

      expect(result.sectionsWithGaps.length).toBeGreaterThan(0);
    });

    it('should generate unique gap IDs', () => {
      const analyzer = new GapAnalyzer();
      const info = createMinimalCollectedInfo();

      const result = analyzer.analyze(info);

      const allGaps = [
        ...result.criticalGaps,
        ...result.majorGaps,
        ...result.minorGaps,
        ...result.infoGaps,
      ];
      const ids = allGaps.map((g) => g.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });
});
