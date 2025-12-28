import { describe, it, expect } from 'vitest';
import { ComponentDesigner } from '../../src/sds-writer/ComponentDesigner.js';
import type {
  ParsedSRSFeature,
  ParsedUseCase,
  ParsedNFR,
  ParsedConstraint,
} from '../../src/sds-writer/types.js';

describe('ComponentDesigner', () => {
  const createSampleFeatures = (): ParsedSRSFeature[] => [
    {
      id: 'SF-001',
      name: 'User Authentication',
      description: 'Users can authenticate using email and password.',
      priority: 'P0',
      sourceRequirements: ['FR-001'],
      useCaseIds: ['UC-001', 'UC-002'],
      acceptanceCriteria: [
        'User can log in with valid credentials',
        'User receives error for invalid credentials',
        'Session is created upon successful login',
      ],
    },
    {
      id: 'SF-002',
      name: 'Data Export',
      description: 'Users can export their data. Depends on SF-001 for authentication.',
      priority: 'P1',
      sourceRequirements: ['FR-002'],
      useCaseIds: ['UC-003'],
      acceptanceCriteria: [
        'User can export to CSV format',
        'User can export to JSON format',
      ],
    },
  ];

  const createSampleUseCases = (): ParsedUseCase[] => [
    {
      id: 'UC-001',
      name: 'User Login',
      primaryActor: 'User',
      preconditions: ['User has an account'],
      mainScenario: [
        'User enters email',
        'User enters password',
        'System validates credentials',
        'System creates session',
      ],
      alternativeScenarios: [
        {
          name: 'Invalid Credentials',
          steps: ['System shows error message', 'User can retry'],
        },
      ],
      postconditions: ['User is logged in'],
      sourceFeatureId: 'SF-001',
    },
  ];

  const createSampleNFRs = (): ParsedNFR[] => [
    {
      id: 'NFR-001',
      category: 'Performance',
      description: 'System response time must be under 200ms',
      metric: 'Response time < 200ms',
      priority: 'P1',
    },
    {
      id: 'NFR-002',
      category: 'Security',
      description: 'All data must be encrypted',
      priority: 'P0',
    },
  ];

  const createSampleConstraints = (): ParsedConstraint[] => [
    {
      id: 'CON-001',
      type: 'Technical',
      description: 'Must use TypeScript',
    },
  ];

  describe('design', () => {
    it('should design components from features', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        createSampleUseCases(),
        createSampleNFRs(),
        createSampleConstraints()
      );

      expect(result.components).toHaveLength(2);
      expect(result.failedFeatures).toHaveLength(0);
    });

    it('should generate component IDs in sequence', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        [],
        [],
        []
      );

      expect(result.components[0]?.id).toBe('CMP-001');
      expect(result.components[1]?.id).toBe('CMP-002');
    });

    it('should link components to source features', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        [],
        [],
        []
      );

      expect(result.components[0]?.sourceFeature).toBe('SF-001');
      expect(result.components[1]?.sourceFeature).toBe('SF-002');
    });

    it('should preserve feature priority in components', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        [],
        [],
        []
      );

      expect(result.components[0]?.priority).toBe('P0');
      expect(result.components[1]?.priority).toBe('P1');
    });
  });

  describe('component naming', () => {
    it('should generate proper component names', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        [],
        [],
        []
      );

      expect(result.components[0]?.name).toContain('Authentication');
      expect(result.components[1]?.name).toContain('Export');
    });

    it('should add appropriate suffixes', () => {
      const designer = new ComponentDesigner();
      const features: ParsedSRSFeature[] = [
        {
          id: 'SF-001',
          name: 'User Data Storage',
          description: 'Stores user data',
          priority: 'P1',
          sourceRequirements: [],
          useCaseIds: [],
          acceptanceCriteria: [],
        },
      ];

      const result = designer.design(features, [], [], []);
      expect(result.components[0]?.name).toMatch(/(Repository|Manager|Service)/);
    });
  });

  describe('interface generation', () => {
    it('should generate interfaces from acceptance criteria', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        [],
        [],
        []
      );

      const authComponent = result.components[0];
      expect(authComponent?.interfaces.length).toBeGreaterThan(0);
    });

    it('should generate methods from use cases', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        createSampleUseCases(),
        [],
        []
      );

      const authComponent = result.components[0];
      // Should have interfaces from both acceptance criteria and use cases
      expect(authComponent?.interfaces.length).toBeGreaterThanOrEqual(1);
    });

    it('should skip interfaces when disabled', () => {
      const designer = new ComponentDesigner({ generateInterfaces: false });
      const result = designer.design(
        createSampleFeatures(),
        createSampleUseCases(),
        [],
        []
      );

      expect(result.components[0]?.interfaces).toHaveLength(0);
    });
  });

  describe('dependencies', () => {
    it('should detect dependencies from feature descriptions', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        [],
        [],
        []
      );

      // SF-002 mentions SF-001 in its description
      const exportComponent = result.components.find((c) => c.sourceFeature === 'SF-002');
      expect(exportComponent?.dependencies).toContain('CMP-001');
    });
  });

  describe('implementation notes', () => {
    it('should include NFR-based notes', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        [],
        createSampleNFRs(),
        []
      );

      const component = result.components[0];
      expect(component?.implementationNotes).toContain('Performance');
    });

    it('should include constraint-based notes', () => {
      const designer = new ComponentDesigner();
      const result = designer.design(
        createSampleFeatures(),
        [],
        [],
        createSampleConstraints()
      );

      const component = result.components[0];
      expect(component?.implementationNotes).toContain('Technical');
    });

    it('should skip notes when disabled', () => {
      const designer = new ComponentDesigner({ includeImplementationNotes: false });
      const result = designer.design(
        createSampleFeatures(),
        [],
        createSampleNFRs(),
        createSampleConstraints()
      );

      expect(result.components[0]?.implementationNotes).toBe('');
    });
  });

  describe('technology suggestions', () => {
    it('should suggest JWT for auth features', () => {
      const designer = new ComponentDesigner();
      const features: ParsedSRSFeature[] = [
        {
          id: 'SF-001',
          name: 'Authentication System',
          description: 'Handles user authentication',
          priority: 'P0',
          sourceRequirements: [],
          useCaseIds: [],
          acceptanceCriteria: [],
        },
      ];

      const result = designer.design(features, [], [], []);
      expect(result.components[0]?.technology).toContain('JWT');
    });

    it('should suggest database for storage features', () => {
      const designer = new ComponentDesigner();
      const features: ParsedSRSFeature[] = [
        {
          id: 'SF-001',
          name: 'Data Storage',
          description: 'Stores data in database',
          priority: 'P1',
          sourceRequirements: [],
          useCaseIds: [],
          acceptanceCriteria: [],
        },
      ];

      const result = designer.design(features, [], [], []);
      expect(result.components[0]?.technology).toMatch(/(PostgreSQL|MongoDB)/);
    });
  });

  describe('designComponent', () => {
    it('should design single component from input', () => {
      const designer = new ComponentDesigner();
      const input = {
        feature: createSampleFeatures()[0]!,
        useCases: createSampleUseCases(),
        nfrs: createSampleNFRs(),
        constraints: createSampleConstraints(),
        componentIndex: 1,
      };

      const component = designer.designComponent(input);

      expect(component.id).toBe('CMP-001');
      expect(component.sourceFeature).toBe('SF-001');
      expect(component.priority).toBe('P0');
    });
  });

  describe('edge cases', () => {
    it('should handle empty features array', () => {
      const designer = new ComponentDesigner();
      const result = designer.design([], [], [], []);

      expect(result.components).toHaveLength(0);
      expect(result.failedFeatures).toHaveLength(0);
    });

    it('should handle features without acceptance criteria', () => {
      const designer = new ComponentDesigner();
      const features: ParsedSRSFeature[] = [
        {
          id: 'SF-001',
          name: 'Simple Feature',
          description: 'A feature without acceptance criteria',
          priority: 'P1',
          sourceRequirements: [],
          useCaseIds: [],
          acceptanceCriteria: [],
        },
      ];

      const result = designer.design(features, [], [], []);

      expect(result.components).toHaveLength(1);
      // Should generate default CRUD methods
      expect(result.components[0]?.interfaces.length).toBeGreaterThan(0);
    });
  });
});
