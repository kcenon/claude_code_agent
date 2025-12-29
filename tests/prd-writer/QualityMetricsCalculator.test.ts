import { describe, it, expect } from 'vitest';
import { QualityMetricsCalculator } from '../../src/prd-writer/QualityMetricsCalculator.js';
import { GapAnalyzer } from '../../src/prd-writer/GapAnalyzer.js';
import { ConsistencyChecker } from '../../src/prd-writer/ConsistencyChecker.js';
import type { CollectedInfo } from '../../src/scratchpad/index.js';
import type { GapAnalysisResult, ConsistencyCheckResult } from '../../src/prd-writer/types.js';

describe('QualityMetricsCalculator', () => {
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

  const createGapAnalysisResult = (
    overrides: Partial<GapAnalysisResult> = {}
  ): GapAnalysisResult => ({
    totalGaps: 0,
    criticalGaps: [],
    majorGaps: [],
    minorGaps: [],
    infoGaps: [],
    completenessScore: 0.8,
    sectionsWithGaps: [],
    ...overrides,
  });

  const createConsistencyCheckResult = (
    overrides: Partial<ConsistencyCheckResult> = {}
  ): ConsistencyCheckResult => ({
    isConsistent: true,
    issues: [],
    priorityDistribution: {
      p0Count: 0,
      p1Count: 0,
      p2Count: 0,
      p3Count: 0,
      isBalanced: true,
    },
    dependencyAnalysis: {
      totalDependencies: 0,
      missingBidirectional: [],
      circularChains: [],
    },
    ...overrides,
  });

  describe('constructor', () => {
    it('should create calculator with default options', () => {
      const calculator = new QualityMetricsCalculator();
      expect(calculator).toBeDefined();
    });

    it('should create calculator with custom options', () => {
      const calculator = new QualityMetricsCalculator({
        completenessWeight: 0.5,
        consistencyWeight: 0.3,
        clarityWeight: 0.2,
      });
      expect(calculator).toBeDefined();
    });
  });

  describe('calculate', () => {
    it('should return quality metrics with all required fields', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo();
      const gapAnalysis = createGapAnalysisResult();
      const consistencyCheck = createConsistencyCheckResult();

      const result = calculator.calculate(info, gapAnalysis, consistencyCheck);

      expect(result).toBeDefined();
      expect(typeof result.completeness).toBe('number');
      expect(typeof result.consistency).toBe('number');
      expect(typeof result.clarity).toBe('number');
      expect(typeof result.overall).toBe('number');
    });

    it('should return scores between 0 and 1', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo();
      const gapAnalysis = createGapAnalysisResult();
      const consistencyCheck = createConsistencyCheckResult();

      const result = calculator.calculate(info, gapAnalysis, consistencyCheck);

      expect(result.completeness).toBeGreaterThanOrEqual(0);
      expect(result.completeness).toBeLessThanOrEqual(1);
      expect(result.consistency).toBeGreaterThanOrEqual(0);
      expect(result.consistency).toBeLessThanOrEqual(1);
      expect(result.clarity).toBeGreaterThanOrEqual(0);
      expect(result.clarity).toBeLessThanOrEqual(1);
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateDetailed', () => {
    it('should return detailed quality metrics with clarity analysis', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo();
      const gapAnalysis = createGapAnalysisResult();
      const consistencyCheck = createConsistencyCheckResult();

      const result = calculator.calculateDetailed(info, gapAnalysis, consistencyCheck);

      expect(result).toBeDefined();
      expect(result.clarityAnalysis).toBeDefined();
      expect(typeof result.clarityAnalysis.clarityScore).toBe('number');
      expect(Array.isArray(result.clarityAnalysis.issues)).toBe(true);
      expect(typeof result.analyzedAt).toBe('string');
    });
  });

  describe('calculateCompleteness', () => {
    it('should use completeness score from gap analysis', () => {
      const calculator = new QualityMetricsCalculator();
      const gapAnalysis = createGapAnalysisResult({ completenessScore: 0.75 });

      const result = calculator.calculateCompleteness(gapAnalysis);

      expect(result).toBe(0.75);
    });
  });

  describe('calculateConsistency', () => {
    it('should return 1.0 for consistent requirements with no issues', () => {
      const calculator = new QualityMetricsCalculator();
      const consistencyCheck = createConsistencyCheckResult({
        isConsistent: true,
        issues: [],
      });

      const result = calculator.calculateConsistency(consistencyCheck);

      expect(result).toBe(1.0);
    });

    it('should deduct points for critical issues', () => {
      const calculator = new QualityMetricsCalculator();
      const consistencyCheck = createConsistencyCheckResult({
        isConsistent: false,
        issues: [
          {
            id: 'CON-001',
            type: 'conflicting_requirements',
            severity: 'critical',
            description: 'Critical conflict',
            relatedIds: ['FR-001', 'FR-002'],
            suggestion: 'Resolve conflict',
          },
        ],
      });

      const result = calculator.calculateConsistency(consistencyCheck);

      expect(result).toBeLessThan(1.0);
      expect(result).toBe(0.75); // 1.0 - 0.25 for critical
    });

    it('should deduct points for major issues', () => {
      const calculator = new QualityMetricsCalculator();
      const consistencyCheck = createConsistencyCheckResult({
        isConsistent: false,
        issues: [
          {
            id: 'CON-001',
            type: 'duplicate_requirement',
            severity: 'major',
            description: 'Duplicate found',
            relatedIds: ['FR-001', 'FR-002'],
            suggestion: 'Merge requirements',
          },
        ],
      });

      const result = calculator.calculateConsistency(consistencyCheck);

      expect(result).toBe(0.85); // 1.0 - 0.15 for major
    });

    it('should deduct points for unbalanced priorities', () => {
      const calculator = new QualityMetricsCalculator();
      const consistencyCheck = createConsistencyCheckResult({
        priorityDistribution: {
          p0Count: 5,
          p1Count: 0,
          p2Count: 0,
          p3Count: 0,
          isBalanced: false,
          recommendation: 'Too many P0 requirements',
        },
      });

      const result = calculator.calculateConsistency(consistencyCheck);

      expect(result).toBe(0.95); // 1.0 - 0.05 for unbalanced
    });

    it('should deduct points for circular dependencies', () => {
      const calculator = new QualityMetricsCalculator();
      const consistencyCheck = createConsistencyCheckResult({
        dependencyAnalysis: {
          totalDependencies: 2,
          missingBidirectional: [],
          circularChains: [['FR-001', 'FR-002', 'FR-001']],
        },
      });

      const result = calculator.calculateConsistency(consistencyCheck);

      expect(result).toBe(0.9); // 1.0 - 0.1 for one circular chain
    });

    it('should clamp result to minimum of 0', () => {
      const calculator = new QualityMetricsCalculator();
      const consistencyCheck = createConsistencyCheckResult({
        isConsistent: false,
        issues: [
          {
            id: 'CON-001',
            type: 'conflicting_requirements',
            severity: 'critical',
            description: 'Critical conflict 1',
            relatedIds: ['FR-001'],
            suggestion: 'Fix',
          },
          {
            id: 'CON-002',
            type: 'conflicting_requirements',
            severity: 'critical',
            description: 'Critical conflict 2',
            relatedIds: ['FR-002'],
            suggestion: 'Fix',
          },
          {
            id: 'CON-003',
            type: 'conflicting_requirements',
            severity: 'critical',
            description: 'Critical conflict 3',
            relatedIds: ['FR-003'],
            suggestion: 'Fix',
          },
          {
            id: 'CON-004',
            type: 'conflicting_requirements',
            severity: 'critical',
            description: 'Critical conflict 4',
            relatedIds: ['FR-004'],
            suggestion: 'Fix',
          },
          {
            id: 'CON-005',
            type: 'conflicting_requirements',
            severity: 'critical',
            description: 'Critical conflict 5',
            relatedIds: ['FR-005'],
            suggestion: 'Fix',
          },
        ],
        dependencyAnalysis: {
          totalDependencies: 10,
          missingBidirectional: [],
          circularChains: [
            ['A', 'B', 'A'],
            ['C', 'D', 'C'],
            ['E', 'F', 'E'],
          ],
        },
      });

      const result = calculator.calculateConsistency(consistencyCheck);

      expect(result).toBe(0); // Should be clamped to 0
    });
  });

  describe('analyzeClarity', () => {
    it('should detect ambiguous terms', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Test Project',
          description: 'The system should be fast and user-friendly with good performance.',
        },
      });

      const result = calculator.analyzeClarity(info);

      expect(result.ambiguousTermCount).toBeGreaterThan(0);
      const ambiguousIssues = result.issues.filter((i) => i.type === 'ambiguous_term');
      expect(ambiguousIssues.length).toBeGreaterThan(0);
    });

    it('should detect long sentences', () => {
      const calculator = new QualityMetricsCalculator({ maxSentenceLength: 10 });
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Test Project',
          description:
            'This is a very long sentence that contains more than ten words and should be flagged by the clarity analyzer as too long.',
        },
      });

      const result = calculator.analyzeClarity(info);

      const longSentenceIssues = result.issues.filter((i) => i.type === 'long_sentence');
      expect(longSentenceIssues.length).toBeGreaterThan(0);
    });

    it('should detect passive voice', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Test Project',
          description: 'The data is processed by the system. The results are stored in the database.',
        },
      });

      const result = calculator.analyzeClarity(info);

      expect(result.passiveVoicePercentage).toBeGreaterThan(0);
      const passiveIssues = result.issues.filter((i) => i.type === 'passive_voice');
      expect(passiveIssues.length).toBeGreaterThan(0);
    });

    it('should detect vague references', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Test Project',
          description: 'It is important for the system. This is required for operation.',
        },
      });

      const result = calculator.analyzeClarity(info);

      const vagueRefIssues = result.issues.filter((i) => i.type === 'vague_reference');
      expect(vagueRefIssues.length).toBeGreaterThan(0);
    });

    it('should return high clarity score for clear text', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Customer Management System',
          description:
            'The Customer Management System stores customer data in a PostgreSQL database. Each customer record contains name, email, and phone number fields.',
        },
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Customer Registration',
              description:
                'Users create customer records by entering name, email, and phone number.',
              priority: 'P0',
              status: 'Proposed',
              acceptanceCriteria: [
                {
                  id: 'AC-001',
                  description: 'The system validates email format before saving.',
                  testable: true,
                },
              ],
              dependencies: [],
              userStories: [],
            },
          ],
          nonFunctional: [],
        },
      });

      const result = calculator.analyzeClarity(info);

      expect(result.clarityScore).toBeGreaterThan(0.5);
    });

    it('should generate unique clarity issue IDs', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo({
        project: {
          name: 'Test',
          description: 'Some fast and good system that may work.',
        },
      });

      const result = calculator.analyzeClarity(info);

      const ids = result.issues.map((i) => i.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should analyze requirements and acceptance criteria', () => {
      const calculator = new QualityMetricsCalculator();
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Some feature',
              description: 'It should be fast and user-friendly.',
              priority: 'P0',
              status: 'Proposed',
              acceptanceCriteria: [
                {
                  id: 'AC-001',
                  description: 'The feature should work appropriately.',
                  testable: true,
                },
              ],
              dependencies: [],
              userStories: [],
            },
          ],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Good performance',
              description: 'The system should respond quickly.',
              priority: 'P1',
            },
          ],
        },
      });

      const result = calculator.analyzeClarity(info);

      // Should find ambiguous terms in requirements
      expect(result.ambiguousTermCount).toBeGreaterThan(0);
    });
  });

  describe('integration with GapAnalyzer and ConsistencyChecker', () => {
    it('should work with real analyzer results', () => {
      const gapAnalyzer = new GapAnalyzer();
      const consistencyChecker = new ConsistencyChecker();
      const qualityCalculator = new QualityMetricsCalculator();

      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'User Authentication',
              description: 'Users authenticate using email and password credentials.',
              priority: 'P0',
              status: 'Proposed',
              acceptanceCriteria: [
                {
                  id: 'AC-001',
                  description: 'Users log in with valid credentials.',
                  testable: true,
                },
              ],
              dependencies: [],
              userStories: [],
            },
            {
              id: 'FR-002',
              title: 'Profile Management',
              description: 'Users update profile information including name and email.',
              priority: 'P1',
              status: 'Proposed',
              acceptanceCriteria: [
                {
                  id: 'AC-002',
                  description: 'Profile changes persist after logout.',
                  testable: true,
                },
              ],
              dependencies: [],
              userStories: [],
            },
          ],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Response Time',
              description: 'API response time under 200ms.',
              priority: 'P1',
              metric: '< 200ms',
            },
          ],
        },
        constraints: [
          {
            id: 'CON-001',
            description: 'TypeScript required',
            reason: 'Team expertise',
          },
        ],
      });

      const gapAnalysis = gapAnalyzer.analyze(info);
      const consistencyCheck = consistencyChecker.check(info);
      const qualityMetrics = qualityCalculator.calculate(info, gapAnalysis, consistencyCheck);

      expect(qualityMetrics.completeness).toBeGreaterThan(0);
      expect(qualityMetrics.consistency).toBeGreaterThan(0);
      expect(qualityMetrics.clarity).toBeGreaterThan(0);
      expect(qualityMetrics.overall).toBeGreaterThan(0);
    });
  });

  describe('overall score calculation', () => {
    it('should calculate weighted average of scores', () => {
      const calculator = new QualityMetricsCalculator({
        completenessWeight: 0.4,
        consistencyWeight: 0.35,
        clarityWeight: 0.25,
      });
      const info = createMinimalCollectedInfo();
      const gapAnalysis = createGapAnalysisResult({ completenessScore: 0.8 });
      const consistencyCheck = createConsistencyCheckResult();

      const result = calculator.calculate(info, gapAnalysis, consistencyCheck);

      // Overall should be a weighted average
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });

    it('should respect custom weights', () => {
      // High completeness weight
      const calculator1 = new QualityMetricsCalculator({
        completenessWeight: 1.0,
        consistencyWeight: 0.0,
        clarityWeight: 0.0,
      });

      const info = createMinimalCollectedInfo();
      const gapAnalysis = createGapAnalysisResult({ completenessScore: 0.5 });
      const consistencyCheck = createConsistencyCheckResult();

      const result1 = calculator1.calculate(info, gapAnalysis, consistencyCheck);

      // With only completeness weight, overall should equal completeness
      expect(result1.overall).toBeCloseTo(0.5, 1);
    });
  });
});
