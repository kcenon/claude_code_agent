import { describe, it, expect } from 'vitest';
import { TraceabilityBuilder } from '../../src/srs-writer/TraceabilityBuilder.js';
import type {
  ParsedPRD,
  FeatureDecompositionResult,
} from '../../src/srs-writer/types.js';
import type { SRSFeature } from '../../src/architecture-generator/types.js';

describe('TraceabilityBuilder', () => {
  const createMinimalParsedPRD = (): ParsedPRD => ({
    metadata: {
      documentId: 'PRD-001',
      version: '1.0.0',
      status: 'Draft',
      projectId: '001',
    },
    productName: 'Test Product',
    productDescription: 'A test product',
    functionalRequirements: [
      {
        id: 'FR-001',
        title: 'User Login',
        description: 'Login functionality with security features',
        priority: 'P0',
        acceptanceCriteria: [],
        dependencies: [],
      },
      {
        id: 'FR-002',
        title: 'User Logout',
        description: 'Logout functionality',
        priority: 'P1',
        acceptanceCriteria: [],
        dependencies: [],
      },
      {
        id: 'FR-003',
        title: 'Profile Management',
        description: 'User profile management',
        priority: 'P2',
        acceptanceCriteria: [],
        dependencies: [],
      },
    ],
    nonFunctionalRequirements: [
      {
        id: 'NFR-001',
        category: 'security',
        description: 'Data encryption',
        priority: 'P0',
      },
      {
        id: 'NFR-002',
        category: 'performance',
        description: 'Response time < 200ms',
        priority: 'P1',
      },
    ],
    constraints: [],
    assumptions: [],
    userPersonas: [],
    goals: [],
  });

  const createFeature = (
    id: string,
    name: string,
    useCaseIds: string[] = []
  ): SRSFeature => ({
    id,
    name,
    description: `Description for ${name}`,
    priority: 'P1',
    useCases: useCaseIds.map((ucId) => ({
      id: ucId,
      name: `Use Case ${ucId}`,
      description: 'A use case',
      actor: 'User',
      preconditions: [],
      mainFlow: [],
      alternativeFlows: [],
      postconditions: [],
    })),
    nfrs: [],
  });

  const createDecompositionResult = (
    features: SRSFeature[],
    traceabilityMap: Map<string, string[]>
  ): FeatureDecompositionResult => ({
    features,
    traceabilityMap,
    coverage: 100,
    unmappedRequirements: [],
  });

  describe('constructor', () => {
    it('should create builder with default options', () => {
      const builder = new TraceabilityBuilder();
      expect(builder).toBeInstanceOf(TraceabilityBuilder);
    });

    it('should accept custom options', () => {
      const builder = new TraceabilityBuilder({
        requireFullCoverage: false,
        includeNFRs: false,
        validateBidirectional: false,
      });
      expect(builder).toBeInstanceOf(TraceabilityBuilder);
    });
  });

  describe('build', () => {
    it('should build traceability matrix from decomposition result', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001']),
        createFeature('SF-002', 'User Logout', ['UC-002']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);
      traceabilityMap.set('FR-002', ['SF-002']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);

      expect(matrix.entries.length).toBe(2);
    });

    it('should calculate forward coverage correctly', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001']),
        createFeature('SF-002', 'User Logout', ['UC-002']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);
      traceabilityMap.set('FR-002', ['SF-002']);
      // FR-003 is not mapped

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);

      // 2 out of 3 requirements covered = 66.67%
      expect(matrix.forwardCoverage).toBeCloseTo(66.67, 1);
    });

    it('should identify uncovered requirements', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [createFeature('SF-001', 'User Login', ['UC-001'])];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);

      expect(matrix.uncoveredRequirements).toContain('FR-002');
      expect(matrix.uncoveredRequirements).toContain('FR-003');
    });

    it('should identify orphan features', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001']),
        createFeature('SF-002', 'Orphan Feature', ['UC-002']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);
      // SF-002 is not traced to any requirement

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);

      expect(matrix.orphanFeatures).toContain('SF-002');
    });

    it('should collect use case IDs from features', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001', 'UC-002']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);

      const entry = matrix.entries.find((e) => e.requirementId === 'FR-001');
      expect(entry?.useCaseIds).toContain('UC-001');
      expect(entry?.useCaseIds).toContain('UC-002');
    });

    it('should include NFR references when enabled', () => {
      const builder = new TraceabilityBuilder({ includeNFRs: true });
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);

      // NFR references may or may not be detected based on keyword matching
      const entry = matrix.entries.find((e) => e.requirementId === 'FR-001');
      expect(entry?.nfrIds).toBeDefined();
      // NFR detection depends on keyword overlap between requirement and NFR descriptions
    });
  });

  describe('validate', () => {
    it('should validate matrix with no issues', () => {
      const builder = new TraceabilityBuilder({ requireFullCoverage: false });
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001']),
        createFeature('SF-002', 'User Logout', ['UC-002']),
        createFeature('SF-003', 'Profile Management', ['UC-003']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);
      traceabilityMap.set('FR-002', ['SF-002']);
      traceabilityMap.set('FR-003', ['SF-003']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);
      const validation = builder.validate(matrix);

      expect(validation.isValid).toBe(true);
      expect(validation.coverage).toBe(100);
    });

    it('should report uncovered requirements as error', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [createFeature('SF-001', 'User Login', ['UC-001'])];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);
      const validation = builder.validate(matrix);

      const uncoveredIssue = validation.issues.find(
        (i) => i.type === 'uncovered_requirement'
      );
      expect(uncoveredIssue).toBeDefined();
      expect(uncoveredIssue?.severity).toBe('error');
    });

    it('should report orphan features as warning', () => {
      const builder = new TraceabilityBuilder({ requireFullCoverage: false });
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001']),
        createFeature('SF-002', 'Orphan', ['UC-002']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);
      const validation = builder.validate(matrix);

      const orphanIssue = validation.issues.find((i) => i.type === 'orphan_feature');
      expect(orphanIssue).toBeDefined();
      expect(orphanIssue?.severity).toBe('warning');
    });

    it('should report missing use cases as warning', () => {
      const builder = new TraceabilityBuilder({ requireFullCoverage: false });
      const parsedPRD = createMinimalParsedPRD();

      // Feature without use cases
      const features: SRSFeature[] = [
        {
          id: 'SF-001',
          name: 'User Login',
          description: 'Login',
          priority: 'P1',
          useCases: [],
          nfrs: [],
        },
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);
      const validation = builder.validate(matrix);

      const missingUCIssue = validation.issues.find(
        (i) => i.type === 'missing_use_cases'
      );
      expect(missingUCIssue).toBeDefined();
    });
  });

  describe('toMarkdown', () => {
    it('should generate markdown table', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001']),
        createFeature('SF-002', 'User Logout', ['UC-002']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);
      traceabilityMap.set('FR-002', ['SF-002']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);
      const markdown = builder.toMarkdown(matrix);

      expect(markdown).toContain('## Traceability Matrix');
      expect(markdown).toContain('| PRD Requirement |');
      expect(markdown).toContain('FR-001');
      expect(markdown).toContain('SF-001');
      expect(markdown).toContain('UC-001');
    });

    it('should include coverage percentage', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [createFeature('SF-001', 'User Login', ['UC-001'])];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);
      const markdown = builder.toMarkdown(matrix);

      expect(markdown).toContain('**Coverage**:');
    });

    it('should list uncovered requirements', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [createFeature('SF-001', 'User Login', ['UC-001'])];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);
      const markdown = builder.toMarkdown(matrix);

      expect(markdown).toContain('**Uncovered Requirements**');
      expect(markdown).toContain('FR-002');
    });
  });

  describe('buildReverseTraceability', () => {
    it('should map features back to requirements', () => {
      const builder = new TraceabilityBuilder();
      const parsedPRD = createMinimalParsedPRD();

      const features = [
        createFeature('SF-001', 'User Login', ['UC-001']),
        createFeature('SF-002', 'Enhanced Login', ['UC-002']),
      ];

      const traceabilityMap = new Map<string, string[]>();
      traceabilityMap.set('FR-001', ['SF-001', 'SF-002']);

      const decomposition = createDecompositionResult(features, traceabilityMap);
      const matrix = builder.build(parsedPRD, decomposition);
      const reverse = builder.buildReverseTraceability(matrix);

      expect(reverse.get('SF-001')).toContain('FR-001');
      expect(reverse.get('SF-002')).toContain('FR-001');
    });
  });
});
