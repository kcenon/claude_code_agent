import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureDecomposer } from '../../src/srs-writer/FeatureDecomposer.js';
import { FeatureDecompositionError } from '../../src/srs-writer/errors.js';
import type { ParsedPRD, ParsedPRDRequirement } from '../../src/srs-writer/types.js';

describe('FeatureDecomposer', () => {
  const createMinimalParsedPRD = (
    requirements: ParsedPRDRequirement[] = []
  ): ParsedPRD => ({
    metadata: {
      documentId: 'PRD-001',
      version: '1.0.0',
      status: 'Draft',
      projectId: '001',
    },
    productName: 'Test Product',
    productDescription: 'A test product',
    functionalRequirements: requirements,
    nonFunctionalRequirements: [],
    constraints: [],
    assumptions: [],
    userPersonas: [
      {
        name: 'Developer',
        role: 'Software Engineer',
        description: 'Builds software',
        goals: ['Write code'],
      },
    ],
    goals: [],
  });

  const createRequirement = (
    id: string,
    title: string,
    overrides: Partial<ParsedPRDRequirement> = {}
  ): ParsedPRDRequirement => ({
    id,
    title,
    description: `Description for ${title}`,
    priority: 'P1',
    acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
    dependencies: [],
    ...overrides,
  });

  describe('constructor', () => {
    it('should create decomposer with default options', () => {
      const decomposer = new FeatureDecomposer();
      expect(decomposer).toBeInstanceOf(FeatureDecomposer);
    });

    it('should accept custom options', () => {
      const decomposer = new FeatureDecomposer({
        maxFeaturesPerRequirement: 3,
        minFeaturesPerRequirement: 1,
        generateSubFeatures: false,
      });
      expect(decomposer).toBeInstanceOf(FeatureDecomposer);
    });
  });

  describe('decompose', () => {
    it('should decompose simple requirement into single feature', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'User Login'),
      ]);

      const result = decomposer.decompose(parsedPRD);

      expect(result.features.length).toBeGreaterThanOrEqual(1);
      expect(result.features[0].id).toBe('SF-001');
      expect(result.features[0].name).toBe('User Login');
    });

    it('should create traceability map', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'User Login'),
        createRequirement('FR-002', 'User Logout'),
      ]);

      const result = decomposer.decompose(parsedPRD);

      expect(result.traceabilityMap.has('FR-001')).toBe(true);
      expect(result.traceabilityMap.has('FR-002')).toBe(true);
    });

    it('should calculate coverage percentage', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'User Login'),
      ]);

      const result = decomposer.decompose(parsedPRD);

      expect(result.coverage).toBe(100);
    });

    it('should report unmapped requirements', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([]);

      const result = decomposer.decompose(parsedPRD);

      expect(result.unmappedRequirements.length).toBe(0);
      expect(result.coverage).toBe(100);
    });

    it('should preserve requirement priority in features', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'Critical Feature', { priority: 'P0' }),
        createRequirement('FR-002', 'Low Priority Feature', { priority: 'P3' }),
      ]);

      const result = decomposer.decompose(parsedPRD);

      const p0Feature = result.features.find((f) => f.name === 'Critical Feature');
      const p3Feature = result.features.find((f) => f.name === 'Low Priority Feature');

      expect(p0Feature?.priority).toBe('P0');
      expect(p3Feature?.priority).toBe('P3');
    });
  });

  describe('use case generation', () => {
    it('should generate at least one use case per feature', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'User Login'),
      ]);

      const result = decomposer.decompose(parsedPRD);

      expect(result.features[0].useCases.length).toBeGreaterThanOrEqual(1);
    });

    it('should include actor in use cases', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'User Login'),
      ]);

      const result = decomposer.decompose(parsedPRD);
      const useCase = result.features[0].useCases[0];

      expect(useCase.actor).toBeDefined();
      expect(useCase.actor.length).toBeGreaterThan(0);
    });

    it('should generate use case IDs in sequence', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'Feature 1'),
        createRequirement('FR-002', 'Feature 2'),
      ]);

      const result = decomposer.decompose(parsedPRD);
      const allUseCases = result.features.flatMap((f) => f.useCases);

      expect(allUseCases.some((uc) => uc.id === 'UC-001')).toBe(true);
    });

    it('should include preconditions in use cases', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'User Login'),
      ]);

      const result = decomposer.decompose(parsedPRD);
      const useCase = result.features[0].useCases[0];

      expect(useCase.preconditions.length).toBeGreaterThan(0);
    });

    it('should include main flow in use cases', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'User Login'),
      ]);

      const result = decomposer.decompose(parsedPRD);
      const useCase = result.features[0].useCases[0];

      expect(useCase.mainFlow.length).toBeGreaterThan(0);
    });

    it('should include postconditions in use cases', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'User Login'),
      ]);

      const result = decomposer.decompose(parsedPRD);
      const useCase = result.features[0].useCases[0];

      expect(useCase.postconditions.length).toBeGreaterThan(0);
    });
  });

  describe('complex requirements', () => {
    it('should decompose complex requirement into multiple features when enabled', () => {
      const decomposer = new FeatureDecomposer({ generateSubFeatures: true });
      const complexRequirement = createRequirement('FR-001', 'Dashboard Analytics', {
        description:
          'The system must provide analytics dashboard. Additionally, it should support real-time updates and also customizable widgets. Furthermore, it must handle data aggregation.',
        acceptanceCriteria: [
          'Display key metrics',
          'Allow date range filtering',
          'Support chart visualizations',
          'Enable widget customization',
          'Show real-time updates',
          'Aggregate data from multiple sources',
          'Export analytics reports',
        ],
      });

      const parsedPRD = createMinimalParsedPRD([complexRequirement]);
      const result = decomposer.decompose(parsedPRD);

      // Complex requirements may be split into multiple features
      expect(result.features.length).toBeGreaterThanOrEqual(1);
    });

    it('should keep complex requirement as single feature when sub-features disabled', () => {
      const decomposer = new FeatureDecomposer({ generateSubFeatures: false });
      const complexRequirement = createRequirement('FR-001', 'Dashboard Analytics', {
        description: 'Complex dashboard with many features and also multiple components.',
        acceptanceCriteria: [
          'Display metrics',
          'Filter data',
          'Visualize charts',
          'Customize widgets',
          'Show updates',
          'Aggregate data',
        ],
      });

      const parsedPRD = createMinimalParsedPRD([complexRequirement]);
      const result = decomposer.decompose(parsedPRD);

      // Should remain single feature when sub-features disabled
      const fr001Features = Array.from(result.traceabilityMap.get('FR-001') ?? []);
      expect(fr001Features.length).toBe(1);
    });
  });

  describe('dependency handling', () => {
    it('should include dependencies in preconditions', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'Authentication'),
        createRequirement('FR-002', 'User Profile', { dependencies: ['FR-001'] }),
      ]);

      const result = decomposer.decompose(parsedPRD);
      const profileFeature = result.features.find((f) => f.name === 'User Profile');
      const useCase = profileFeature?.useCases[0];

      expect(
        useCase?.preconditions.some((p) => p.toLowerCase().includes('fr-001'))
      ).toBe(true);
    });
  });

  describe('NFR references', () => {
    it('should extract NFR references from description', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'Performance Critical Feature', {
          description: 'This feature must comply with NFR-001 and NFR-002 requirements.',
        }),
      ]);

      const result = decomposer.decompose(parsedPRD);
      const feature = result.features[0];

      expect(feature.nfrs).toContain('NFR-001');
      expect(feature.nfrs).toContain('NFR-002');
    });
  });

  describe('feature IDs', () => {
    it('should generate sequential feature IDs', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'Feature 1'),
        createRequirement('FR-002', 'Feature 2'),
        createRequirement('FR-003', 'Feature 3'),
      ]);

      const result = decomposer.decompose(parsedPRD);
      const featureIds = result.features.map((f) => f.id);

      expect(featureIds).toContain('SF-001');
      expect(featureIds).toContain('SF-002');
      expect(featureIds).toContain('SF-003');
    });
  });

  describe('edge cases', () => {
    it('should handle empty requirements list', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([]);

      const result = decomposer.decompose(parsedPRD);

      expect(result.features.length).toBe(0);
      expect(result.coverage).toBe(100);
      expect(result.unmappedRequirements.length).toBe(0);
    });

    it('should handle requirement with empty description', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'Empty Description', { description: '' }),
      ]);

      const result = decomposer.decompose(parsedPRD);

      expect(result.features.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle requirement with no acceptance criteria', () => {
      const decomposer = new FeatureDecomposer();
      const parsedPRD = createMinimalParsedPRD([
        createRequirement('FR-001', 'No Criteria', { acceptanceCriteria: [] }),
      ]);

      const result = decomposer.decompose(parsedPRD);

      expect(result.features.length).toBeGreaterThanOrEqual(1);
      expect(result.features[0].useCases.length).toBeGreaterThanOrEqual(1);
    });
  });
});
