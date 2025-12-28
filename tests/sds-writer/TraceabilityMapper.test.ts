import { describe, it, expect } from 'vitest';
import { TraceabilityMapper } from '../../src/sds-writer/TraceabilityMapper.js';
import { LowCoverageError } from '../../src/sds-writer/errors.js';
import type {
  ParsedSRS,
  SDSComponent,
} from '../../src/sds-writer/types.js';

describe('TraceabilityMapper', () => {
  const createSampleSRS = (): ParsedSRS => ({
    metadata: {
      documentId: 'SRS-001',
      sourcePRD: 'PRD-001',
      version: '1.0.0',
      status: 'Draft',
      projectId: 'test-project',
    },
    productName: 'Test Product',
    productDescription: 'Test description',
    features: [
      {
        id: 'SF-001',
        name: 'User Authentication',
        description: 'Auth feature',
        priority: 'P0',
        sourceRequirements: ['FR-001'],
        useCaseIds: ['UC-001'],
        acceptanceCriteria: [],
      },
      {
        id: 'SF-002',
        name: 'Data Export',
        description: 'Export feature',
        priority: 'P1',
        sourceRequirements: ['FR-002'],
        useCaseIds: ['UC-002'],
        acceptanceCriteria: [],
      },
    ],
    useCases: [
      {
        id: 'UC-001',
        name: 'User Login',
        primaryActor: 'User',
        preconditions: [],
        mainScenario: [],
        alternativeScenarios: [],
        postconditions: [],
        sourceFeatureId: 'SF-001',
      },
      {
        id: 'UC-002',
        name: 'Export Data',
        primaryActor: 'User',
        preconditions: [],
        mainScenario: [],
        alternativeScenarios: [],
        postconditions: [],
        sourceFeatureId: 'SF-002',
      },
    ],
    nfrs: [],
    constraints: [],
    assumptions: [],
  });

  const createSampleComponents = (): SDSComponent[] => [
    {
      id: 'CMP-001',
      name: 'AuthenticationService',
      responsibility: 'Handles authentication',
      sourceFeature: 'SF-001',
      priority: 'P0',
      description: 'Auth component',
      interfaces: [],
      dependencies: [],
      implementationNotes: '',
    },
    {
      id: 'CMP-002',
      name: 'ExportManager',
      responsibility: 'Handles export',
      sourceFeature: 'SF-002',
      priority: 'P1',
      description: 'Export component',
      interfaces: [],
      dependencies: ['CMP-001'],
      implementationNotes: '',
    },
  ];

  describe('build', () => {
    it('should build traceability matrix from SRS and components', () => {
      const mapper = new TraceabilityMapper();
      const result = mapper.build(createSampleSRS(), createSampleComponents());

      expect(result.matrix.entries).toHaveLength(2);
      expect(result.matrix.forwardCoverage).toBe(100);
      expect(result.matrix.uncoveredFeatures).toHaveLength(0);
      expect(result.matrix.orphanComponents).toHaveLength(0);
    });

    it('should link components to features', () => {
      const mapper = new TraceabilityMapper();
      const result = mapper.build(createSampleSRS(), createSampleComponents());

      const authEntry = result.matrix.entries.find((e) => e.componentId === 'CMP-001');
      expect(authEntry?.srsFeature).toBe('SF-001');
      expect(authEntry?.prdRequirement).toBe('FR-001');
    });

    it('should link use cases to components', () => {
      const mapper = new TraceabilityMapper();
      const result = mapper.build(createSampleSRS(), createSampleComponents());

      const authEntry = result.matrix.entries.find((e) => e.componentId === 'CMP-001');
      expect(authEntry?.useCases).toContain('UC-001');
    });

    it('should detect uncovered features', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const components = [createSampleComponents()[0]!]; // Only first component

      const result = mapper.build(srs, components);

      expect(result.matrix.uncoveredFeatures).toContain('SF-002');
      expect(result.matrix.forwardCoverage).toBe(50);
    });

    it('should detect orphan components', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const components: SDSComponent[] = [
        ...createSampleComponents(),
        {
          id: 'CMP-003',
          name: 'OrphanComponent',
          responsibility: 'Unknown',
          sourceFeature: 'SF-999', // Non-existent feature
          priority: 'P2',
          description: 'Orphan',
          interfaces: [],
          dependencies: [],
          implementationNotes: '',
        },
      ];

      const result = mapper.build(srs, components);

      expect(result.matrix.orphanComponents).toContain('CMP-003');
    });

    it('should generate warnings for issues', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const components = [createSampleComponents()[0]!]; // Missing SF-002

      const result = mapper.build(srs, components);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('SF-002'))).toBe(true);
    });
  });

  describe('stats', () => {
    it('should calculate statistics correctly', () => {
      const mapper = new TraceabilityMapper();
      const result = mapper.build(createSampleSRS(), createSampleComponents());

      expect(result.stats.totalFeatures).toBe(2);
      expect(result.stats.coveredFeatures).toBe(2);
      expect(result.stats.totalComponents).toBe(2);
      expect(result.stats.tracedComponents).toBe(2);
      expect(result.stats.forwardCoverage).toBe(100);
      expect(result.stats.backwardCoverage).toBe(100);
      expect(result.stats.totalUseCases).toBe(2);
      expect(result.stats.linkedUseCases).toBe(2);
    });
  });

  describe('coverage threshold', () => {
    it('should throw when coverage is below threshold and failOnLowCoverage is true', () => {
      const mapper = new TraceabilityMapper({
        coverageThreshold: 90,
        failOnLowCoverage: true,
      });
      const srs = createSampleSRS();
      const components = [createSampleComponents()[0]!]; // 50% coverage

      expect(() => mapper.build(srs, components)).toThrow(LowCoverageError);
    });

    it('should not throw when failOnLowCoverage is false', () => {
      const mapper = new TraceabilityMapper({
        coverageThreshold: 90,
        failOnLowCoverage: false,
      });
      const srs = createSampleSRS();
      const components = [createSampleComponents()[0]!];

      expect(() => mapper.build(srs, components)).not.toThrow();
    });

    it('should add warning when coverage is below threshold', () => {
      const mapper = new TraceabilityMapper({
        coverageThreshold: 90,
        failOnLowCoverage: false,
      });
      const srs = createSampleSRS();
      const components = [createSampleComponents()[0]!];

      const result = mapper.build(srs, components);

      expect(result.warnings.some((w) => w.includes('below threshold'))).toBe(true);
    });
  });

  describe('toMarkdownTable', () => {
    it('should generate markdown table', () => {
      const mapper = new TraceabilityMapper();
      const result = mapper.build(createSampleSRS(), createSampleComponents());
      const markdown = mapper.toMarkdownTable(result.matrix);

      expect(markdown).toContain('| Component | SRS Feature | Use Cases | PRD Requirement |');
      expect(markdown).toContain('CMP-001');
      expect(markdown).toContain('SF-001');
      expect(markdown).toContain('Coverage');
    });

    it('should include uncovered features in markdown', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const components = [createSampleComponents()[0]!];

      const result = mapper.build(srs, components);
      const markdown = mapper.toMarkdownTable(result.matrix);

      expect(markdown).toContain('Uncovered Features');
      expect(markdown).toContain('SF-002');
    });
  });

  describe('validate', () => {
    it('should return no errors for valid matrix', () => {
      const mapper = new TraceabilityMapper();
      const result = mapper.build(createSampleSRS(), createSampleComponents());
      const errors = mapper.validate(result.matrix);

      expect(errors).toHaveLength(0);
    });

    it('should report uncovered features', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const components = [createSampleComponents()[0]!];

      const result = mapper.build(srs, components);
      const errors = mapper.validate(result.matrix);

      expect(errors.some((e) => e.includes('1 feature(s)'))).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should generate summary report', () => {
      const mapper = new TraceabilityMapper();
      const analysis = mapper.build(createSampleSRS(), createSampleComponents());
      const summary = mapper.getSummary(analysis);

      expect(summary).toContain('Traceability Summary');
      expect(summary).toContain('Coverage Metrics');
      expect(summary).toContain('PASS');
    });

    it('should show FAIL status when coverage is low', () => {
      const mapper = new TraceabilityMapper({ coverageThreshold: 90 });
      const srs = createSampleSRS();
      const components = [createSampleComponents()[0]!];

      const analysis = mapper.build(srs, components);
      const summary = mapper.getSummary(analysis);

      expect(summary).toContain('FAIL');
    });
  });

  describe('merge', () => {
    it('should merge multiple matrices', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const matrix1 = mapper.build(srs, [createSampleComponents()[0]!]).matrix;
      const matrix2 = mapper.build(srs, [createSampleComponents()[1]!]).matrix;

      const merged = mapper.merge(matrix1, matrix2);

      expect(merged.entries).toHaveLength(2);
    });

    it('should deduplicate entries', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const matrix = mapper.build(srs, createSampleComponents()).matrix;

      const merged = mapper.merge(matrix, matrix);

      expect(merged.entries).toHaveLength(2); // Not 4
    });
  });

  describe('filterByPriority', () => {
    it('should filter by priority', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const components = createSampleComponents();

      const result = mapper.build(srs, components);
      const filtered = mapper.filterByPriority(result.matrix, components, 'P0');

      // Only CMP-001 (P0) should remain
      expect(filtered.entries).toHaveLength(1);
      expect(filtered.entries[0]?.componentId).toBe('CMP-001');
    });

    it('should include lower priorities', () => {
      const mapper = new TraceabilityMapper();
      const srs = createSampleSRS();
      const components = createSampleComponents();

      const result = mapper.build(srs, components);
      const filtered = mapper.filterByPriority(result.matrix, components, 'P1');

      // Both CMP-001 (P0) and CMP-002 (P1) should remain
      expect(filtered.entries).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty SRS', () => {
      const mapper = new TraceabilityMapper();
      const emptySRS: ParsedSRS = {
        metadata: {
          documentId: '',
          sourcePRD: '',
          version: '1.0.0',
          status: 'Draft',
          projectId: '',
        },
        productName: '',
        productDescription: '',
        features: [],
        useCases: [],
        nfrs: [],
        constraints: [],
        assumptions: [],
      };

      const result = mapper.build(emptySRS, []);

      expect(result.matrix.entries).toHaveLength(0);
      expect(result.matrix.forwardCoverage).toBe(100); // No features = 100%
    });

    it('should handle components with no use cases', () => {
      const mapper = new TraceabilityMapper({ traceUseCases: false });
      const result = mapper.build(createSampleSRS(), createSampleComponents());

      expect(result.matrix.entries[0]?.useCases).toHaveLength(0);
    });

    it('should handle components with no PRD requirements', () => {
      const mapper = new TraceabilityMapper({ tracePRDRequirements: false });
      const result = mapper.build(createSampleSRS(), createSampleComponents());

      expect(result.matrix.entries[0]?.prdRequirement).toBe('');
    });
  });
});
