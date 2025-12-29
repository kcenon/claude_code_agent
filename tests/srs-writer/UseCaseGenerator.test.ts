import { describe, it, expect, beforeEach } from 'vitest';
import { UseCaseGenerator } from '../../src/srs-writer/UseCaseGenerator.js';
import { UseCaseGenerationError } from '../../src/srs-writer/errors.js';
import type {
  ParsedPRDRequirement,
  UseCaseInput,
  DetailedUseCase,
  FlowStep,
} from '../../src/srs-writer/types.js';
import type { SRSFeature } from '../../src/architecture-generator/types.js';

describe('UseCaseGenerator', () => {
  let generator: UseCaseGenerator;

  const createFeature = (id: string, name: string): SRSFeature => ({
    id,
    name,
    description: `Description for ${name}`,
    priority: 'P1',
    useCases: [],
    nfrs: [],
  });

  const createRequirement = (
    id: string,
    title: string,
    overrides: Partial<ParsedPRDRequirement> = {}
  ): ParsedPRDRequirement => ({
    id,
    title,
    description: `Description for ${title}. User initiates the action and receives response.`,
    priority: 'P1',
    acceptanceCriteria: [
      'User can submit the form',
      'Validation is performed on all inputs',
      'When validation fails, then error message is displayed',
    ],
    dependencies: [],
    ...overrides,
  });

  const createInput = (overrides: Partial<UseCaseInput> = {}): UseCaseInput => ({
    feature: createFeature('SF-001', 'Test Feature'),
    requirement: createRequirement('FR-001', 'Test Requirement'),
    actors: ['User', 'Administrator', 'System'],
    ...overrides,
  });

  beforeEach(() => {
    generator = new UseCaseGenerator();
  });

  describe('constructor', () => {
    it('should create generator with default options', () => {
      expect(generator).toBeInstanceOf(UseCaseGenerator);
    });

    it('should accept custom options', () => {
      const customGenerator = new UseCaseGenerator({
        minUseCasesPerFeature: 2,
        maxUseCasesPerFeature: 10,
        generateExceptionFlows: false,
        includeSecondaryActors: false,
      });
      expect(customGenerator).toBeInstanceOf(UseCaseGenerator);
    });
  });

  describe('generateForFeature', () => {
    it('should generate at least one use case', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);

      expect(result.useCases.length).toBeGreaterThanOrEqual(1);
      expect(result.featureId).toBe('SF-001');
    });

    it('should generate use case with correct structure', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);
      const useCase = result.useCases[0];

      expect(useCase).toBeDefined();
      expect(useCase?.id).toMatch(/^UC-\d{3}$/);
      expect(useCase?.title).toBeDefined();
      expect(useCase?.actor).toBe('User');
      expect(useCase?.preconditions).toBeInstanceOf(Array);
      expect(useCase?.mainFlow).toBeInstanceOf(Array);
      expect(useCase?.alternativeFlows).toBeInstanceOf(Array);
      expect(useCase?.exceptionFlows).toBeInstanceOf(Array);
      expect(useCase?.postconditions).toBeInstanceOf(Array);
    });

    it('should generate main flow with FlowStep structure', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);
      const mainFlow = result.useCases[0]?.mainFlow;

      expect(mainFlow).toBeDefined();
      expect(mainFlow?.length).toBeGreaterThan(0);

      const firstStep = mainFlow?.[0];
      expect(firstStep?.stepNumber).toBe(1);
      expect(firstStep?.description).toBeDefined();
    });

    it('should track source feature and requirement IDs', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);
      const useCase = result.useCases[0];

      expect(useCase?.sourceFeatureId).toBe('SF-001');
      expect(useCase?.sourceRequirementId).toBe('FR-001');
    });

    it('should calculate coverage metrics', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);

      expect(result.coverage).toBeDefined();
      expect(result.coverage.totalCriteria).toBe(3);
      expect(result.coverage.percentage).toBeGreaterThanOrEqual(0);
      expect(result.coverage.percentage).toBeLessThanOrEqual(100);
    });

    it('should respect minUseCasesPerFeature option', () => {
      const customGenerator = new UseCaseGenerator({
        minUseCasesPerFeature: 3,
      });

      const input = createInput({
        requirement: createRequirement('FR-001', 'Simple', {
          acceptanceCriteria: [],
        }),
      });

      const result = customGenerator.generateForFeature(input);
      expect(result.useCases.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('alternative flow generation', () => {
    it('should generate alternative flows from criteria with conditions', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Login', {
          acceptanceCriteria: [
            'User enters credentials',
            'When credentials are invalid, then show error message',
            'If user forgets password, alternatively show reset option',
          ],
        }),
      });

      const result = generator.generateForFeature(input);
      const useCase = result.useCases[0];

      expect(useCase?.alternativeFlows.length).toBeGreaterThan(0);
    });

    it('should label alternative flows correctly', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Login', {
          acceptanceCriteria: ['When validation fails, then show error'],
        }),
      });

      const result = generator.generateForFeature(input);
      const altFlow = result.useCases[0]?.alternativeFlows[0];

      expect(altFlow?.label).toMatch(/^\d+[a-z]$/);
      expect(altFlow?.condition).toBeDefined();
      expect(altFlow?.steps).toBeInstanceOf(Array);
    });
  });

  describe('exception flow generation', () => {
    it('should generate exception flows by default', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);
      const useCase = result.useCases[0];

      expect(useCase?.exceptionFlows.length).toBeGreaterThan(0);
    });

    it('should not generate exception flows when disabled', () => {
      const customGenerator = new UseCaseGenerator({
        generateExceptionFlows: false,
      });

      const input = createInput({
        requirement: createRequirement('FR-001', 'Simple', {
          acceptanceCriteria: [],
        }),
      });

      const result = customGenerator.generateForFeature(input);
      const useCase = result.useCases[0];

      expect(useCase?.exceptionFlows.length).toBe(0);
    });

    it('should generate exception flows from error-related criteria', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Network Operation', {
          acceptanceCriteria: [
            'Operation completes successfully',
            'When network timeout occurs, show retry option',
            'If authentication fails, redirect to login',
          ],
        }),
      });

      const result = generator.generateForFeature(input);
      const useCase = result.useCases[0];

      const exceptionFlows = useCase?.exceptionFlows ?? [];
      expect(exceptionFlows.length).toBeGreaterThan(0);

      const hasTimeoutException = exceptionFlows.some((ef) =>
        ef.exception.toLowerCase().includes('timeout')
      );
      expect(hasTimeoutException).toBe(true);
    });

    it('should structure exception flows correctly', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);
      const exceptionFlow = result.useCases[0]?.exceptionFlows[0];

      expect(exceptionFlow?.label).toMatch(/^E\d+$/);
      expect(exceptionFlow?.exception).toBeDefined();
      expect(exceptionFlow?.handling).toBeDefined();
    });
  });

  describe('actor identification', () => {
    it('should select primary actor from requirement context', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Admin Dashboard', {
          description: 'Administrator can view system metrics',
        }),
      });

      const result = generator.generateForFeature(input);
      const useCase = result.useCases[0];

      expect(useCase?.actor).toBe('Administrator');
    });

    it('should identify secondary actors', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Notify User', {
          description: 'Administrator triggers notification. System sends email to User.',
        }),
      });

      const result = generator.generateForFeature(input);
      const useCase = result.useCases[0];

      expect(useCase?.secondaryActors).toContain('System');
    });

    it('should use default actor when none specified', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Generic Action', {
          description: 'Perform some generic operation',
        }),
        actors: ['User'],
      });

      const result = generator.generateForFeature(input);
      const useCase = result.useCases[0];

      expect(useCase?.actor).toBe('User');
    });
  });

  describe('preconditions and postconditions', () => {
    it('should generate default preconditions', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);
      const preconditions = result.useCases[0]?.preconditions ?? [];

      expect(preconditions).toContain('User is authenticated');
      expect(preconditions).toContain('System is operational');
    });

    it('should add dependency-based preconditions', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Edit Profile', {
          dependencies: ['FR-LOGIN', 'FR-AUTH'],
        }),
      });

      const result = generator.generateForFeature(input);
      const preconditions = result.useCases[0]?.preconditions ?? [];

      expect(preconditions.some((p) => p.includes('FR-LOGIN'))).toBe(true);
    });

    it('should generate postconditions from acceptance criteria', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Save Data', {
          acceptanceCriteria: ['Data is persisted successfully'],
        }),
      });

      const result = generator.generateForFeature(input);
      const postconditions = result.useCases[0]?.postconditions ?? [];

      expect(postconditions.length).toBeGreaterThan(0);
    });
  });

  describe('toBasicUseCase', () => {
    it('should convert detailed use case to basic format', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);
      const detailed = result.useCases[0];

      expect(detailed).toBeDefined();
      const basic = generator.toBasicUseCase(detailed!);

      expect(basic.id).toBe(detailed?.id);
      expect(basic.name).toBe(detailed?.title);
      expect(basic.actor).toBe(detailed?.actor);
      expect(basic.preconditions).toEqual(detailed?.preconditions);
      expect(basic.postconditions).toEqual(detailed?.postconditions);
    });

    it('should convert main flow to string format', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);
      const detailed = result.useCases[0];

      expect(detailed).toBeDefined();
      const basic = generator.toBasicUseCase(detailed!);

      expect(basic.mainFlow.length).toBe(detailed?.mainFlow.length);
      expect(typeof basic.mainFlow[0]).toBe('string');
      expect(basic.mainFlow[0]).toMatch(/^1\./);
    });

    it('should convert alternative flows to string format', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'With Alternatives', {
          acceptanceCriteria: ['When error occurs, then show message'],
        }),
      });

      const result = generator.generateForFeature(input);
      const detailed = result.useCases[0];

      expect(detailed).toBeDefined();
      const basic = generator.toBasicUseCase(detailed!);

      if (detailed?.alternativeFlows && detailed.alternativeFlows.length > 0) {
        expect(basic.alternativeFlows.length).toBe(detailed.alternativeFlows.length);
        expect(typeof basic.alternativeFlows[0]).toBe('string');
      }
    });
  });

  describe('toBasicUseCases', () => {
    it('should convert multiple detailed use cases', () => {
      const input = createInput();
      const result = generator.generateForFeature(input);

      const basicUseCases = generator.toBasicUseCases(result.useCases);

      expect(basicUseCases.length).toBe(result.useCases.length);
      basicUseCases.forEach((uc) => {
        expect(uc.id).toMatch(/^UC-\d{3}$/);
        expect(uc.mainFlow).toBeInstanceOf(Array);
      });
    });
  });

  describe('reset', () => {
    it('should reset use case counter', () => {
      const input = createInput();

      // Generate first batch
      generator.generateForFeature(input);

      // Reset
      generator.reset();

      // Generate second batch
      const result = generator.generateForFeature(input);

      expect(result.useCases[0]?.id).toBe('UC-001');
    });
  });

  describe('user story parsing', () => {
    it('should parse user story format', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Login Feature', {
          userStory: 'As a user, I want to log in so that I can access my account',
        }),
      });

      const result = generator.generateForFeature(input);
      const mainFlow = result.useCases[0]?.mainFlow ?? [];

      expect(mainFlow.length).toBeGreaterThan(0);
    });
  });

  describe('complex requirements', () => {
    it('should handle requirements with many acceptance criteria', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Complex Feature', {
          acceptanceCriteria: [
            'User can view the dashboard',
            'User can filter by date range',
            'User can export data to CSV',
            'When export fails, then show error notification',
            'System should log all export attempts',
            'User must have export permission',
          ],
        }),
      });

      const result = generator.generateForFeature(input);

      expect(result.useCases.length).toBeGreaterThan(1);
      expect(result.coverage.totalCriteria).toBe(6);
    });

    it('should handle requirements with no acceptance criteria', () => {
      const input = createInput({
        requirement: createRequirement('FR-001', 'Simple Feature', {
          acceptanceCriteria: [],
        }),
      });

      const result = generator.generateForFeature(input);

      expect(result.useCases.length).toBeGreaterThanOrEqual(1);
      expect(result.coverage.percentage).toBe(100);
    });
  });
});
