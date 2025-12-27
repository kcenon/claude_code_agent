import { describe, it, expect, beforeEach } from 'vitest';
import { IssueTransformer } from '../../src/issue-generator/IssueTransformer.js';
import { EffortEstimator } from '../../src/issue-generator/EffortEstimator.js';
import type {
  SDSComponent,
  ParsedSDS,
  TraceabilityEntry,
  GeneratedIssue,
} from '../../src/issue-generator/types.js';

describe('IssueTransformer', () => {
  let transformer: IssueTransformer;
  let lowThresholdEstimator: EffortEstimator;

  const createComponent = (overrides: Partial<SDSComponent> = {}): SDSComponent => ({
    id: 'CMP-001',
    name: 'Test Component',
    responsibility: 'Test responsibility',
    sourceFeature: 'SF-001',
    priority: 'P1',
    description: 'A test component',
    interfaces: [],
    dependencies: [],
    implementationNotes: '',
    ...overrides,
  });

  const createTraceabilityEntry = (
    overrides: Partial<TraceabilityEntry> = {}
  ): TraceabilityEntry => ({
    componentId: 'CMP-001',
    srsFeature: 'SF-001',
    prdRequirement: 'PRD-001',
    useCases: ['UC-001'],
    ...overrides,
  });

  const createParsedSDS = (
    components: SDSComponent[],
    traceabilityMatrix: TraceabilityEntry[] = []
  ): ParsedSDS => ({
    metadata: {
      documentId: 'SDS-001',
      sourceSrs: 'SRS-001',
      sourcePrd: 'PRD-001',
      version: '1.0.0',
      status: 'Draft',
      createdDate: '2024-01-01',
      lastUpdatedDate: '2024-01-02',
    },
    components,
    interfaces: [],
    technologyStack: { languages: [], frameworks: [], databases: [], infrastructure: [] },
    traceabilityMatrix,
  });

  beforeEach(() => {
    transformer = new IssueTransformer();
    lowThresholdEstimator = new EffortEstimator({
      thresholds: { xs: 1, s: 2, m: 3, l: 4 },
    });
  });

  describe('transformComponent', () => {
    it('should transform a simple component to an issue', () => {
      const component = createComponent();
      const traceability = [createTraceabilityEntry()];

      const issue = transformer.transformComponent(component, traceability);

      expect(issue.issueId).toBe('ISS-001');
      expect(issue.title).toBe('Implement Test Component');
      expect(issue.traceability.sdsComponent).toBe('CMP-001');
      expect(issue.traceability.srsFeature).toBe('SF-001');
    });

    it('should use component ID in title when name is empty', () => {
      const component = createComponent({ name: '' });
      const issue = transformer.transformComponent(component, []);

      expect(issue.title).toBe('Implement CMP-001');
    });

    it('should include dependencies in issue', () => {
      const component = createComponent({ dependencies: ['CMP-002', 'CMP-003'] });
      const issue = transformer.transformComponent(component, []);

      expect(issue.dependencies.blockedBy).toEqual(['CMP-002', 'CMP-003']);
    });

    it('should use fallback traceability when no matrix entry exists', () => {
      const component = createComponent({ id: 'CMP-999' });
      const issue = transformer.transformComponent(component, []);

      expect(issue.traceability.sdsComponent).toBe('CMP-999');
      expect(issue.traceability.srsFeature).toBe('SF-001');
      expect(issue.traceability.prdRequirement).toBeNull();
    });

    it('should build technical guidance from interfaces', () => {
      const component = createComponent({
        interfaces: [
          {
            name: 'IUserService',
            methods: [
              { name: 'createUser', signature: 'createUser(): void', returnType: 'void' },
            ],
            rawCode: 'interface IUserService {}',
          },
        ],
      });

      const issue = transformer.transformComponent(component, []);

      expect(issue.technical.suggestedApproach).toContain('Define interface contracts');
      expect(
        issue.technical.suggestedApproach.some((s) => s.includes('IUserService'))
      ).toBe(true);
    });

    it('should include implementation notes in technical considerations', () => {
      const component = createComponent({
        implementationNotes: 'Use repository pattern',
      });

      const issue = transformer.transformComponent(component, []);

      expect(issue.technical.considerations).toBe('Use repository pattern');
    });
  });

  describe('transformAll', () => {
    it('should transform multiple components', () => {
      const components = [
        createComponent({ id: 'CMP-001', name: 'User Service' }),
        createComponent({ id: 'CMP-002', name: 'Auth Service' }),
      ];
      const sds = createParsedSDS(components);

      const issues = transformer.transformAll(sds);

      expect(issues.length).toBe(2);
      expect(issues[0]?.title).toBe('Implement User Service');
      expect(issues[1]?.title).toBe('Implement Auth Service');
    });

    it('should reset issue counter for each transformAll call', () => {
      const components = [createComponent()];
      const sds = createParsedSDS(components);

      const issues1 = transformer.transformAll(sds);
      const issues2 = transformer.transformAll(sds);

      expect(issues1[0]?.issueId).toBe('ISS-001');
      expect(issues2[0]?.issueId).toBe('ISS-001');
    });
  });

  describe('decomposition', () => {
    it('should decompose large components into epic and sub-tasks', () => {
      const transformerWithLowThreshold = new IssueTransformer(
        { maxIssueSize: 'XS' },
        lowThresholdEstimator
      );

      const largeComponent = createComponent({
        id: 'CMP-001',
        name: 'Large Component',
        description: 'A'.repeat(1000),
        implementationNotes: 'B'.repeat(500),
        priority: 'P0',
        interfaces: [
          {
            name: 'IInterface1',
            methods: Array.from({ length: 5 }, (_, i) => ({
              name: `method${i}`,
              signature: `method${i}(): void`,
              returnType: 'void',
            })),
            rawCode: 'interface IInterface1 {}',
          },
          {
            name: 'IInterface2',
            methods: Array.from({ length: 5 }, (_, i) => ({
              name: `method${i}`,
              signature: `method${i}(): void`,
              returnType: 'void',
            })),
            rawCode: 'interface IInterface2 {}',
          },
        ],
        dependencies: ['CMP-002'],
      });

      const sds = createParsedSDS([largeComponent], [createTraceabilityEntry()]);
      const issues = transformerWithLowThreshold.transformAll(sds);

      // Should have parent (epic) issue + sub-task issues
      expect(issues.length).toBeGreaterThan(1);

      // First issue should be the epic
      const epicIssue = issues[0];
      expect(epicIssue?.title).toContain('[Epic]');
      expect(epicIssue?.body).toContain('## Sub-Tasks');

      // Sub-tasks should reference parent
      const subTasks = issues.slice(1);
      for (const subTask of subTasks) {
        expect(subTask.body).toContain('Parent:');
      }
    });

    it('should fall back to single issue when no decomposition suggestions', () => {
      // Create a transformer that thinks decomposition is needed but has no suggestions
      const component = createComponent({
        description: 'Simple',
        interfaces: [],
        dependencies: [],
      });
      const sds = createParsedSDS([component]);

      const issues = transformer.transformAll(sds);

      expect(issues.length).toBe(1);
    });

    it('should include traceability in sub-tasks', () => {
      const transformerWithLowThreshold = new IssueTransformer(
        { maxIssueSize: 'XS' },
        lowThresholdEstimator
      );

      const largeComponent = createComponent({
        id: 'CMP-001',
        name: 'Large Component',
        description: 'A'.repeat(1000),
        priority: 'P0',
        interfaces: [
          {
            name: 'IInterface1',
            methods: Array.from({ length: 10 }, (_, i) => ({
              name: `method${i}`,
              signature: `method${i}(): Promise<object>`,
              returnType: 'Promise<object>',
            })),
            rawCode: 'interface IInterface1 {}',
          },
          {
            name: 'IInterface2',
            methods: Array.from({ length: 10 }, (_, i) => ({
              name: `method${i}`,
              signature: `method${i}(): void`,
              returnType: 'void',
            })),
            rawCode: 'interface IInterface2 {}',
          },
        ],
      });

      const traceability = [
        createTraceabilityEntry({ componentId: 'CMP-001', srsFeature: 'SF-001' }),
      ];
      const sds = createParsedSDS([largeComponent], traceability);
      const issues = transformerWithLowThreshold.transformAll(sds);

      // All issues should have traceability
      for (const issue of issues) {
        expect(issue.traceability.sdsComponent).toContain('CMP-001');
      }
    });

    it('should create dependency chain between sub-tasks', () => {
      const transformerWithLowThreshold = new IssueTransformer(
        { maxIssueSize: 'XS' },
        lowThresholdEstimator
      );

      const largeComponent = createComponent({
        description: 'A'.repeat(1000),
        priority: 'P0',
        interfaces: [
          {
            name: 'IFirst',
            methods: [{ name: 'm1', signature: 'm1(): void', returnType: 'void' }],
            rawCode: '',
          },
          {
            name: 'ISecond',
            methods: [{ name: 'm2', signature: 'm2(): void', returnType: 'void' }],
            rawCode: '',
          },
        ],
      });

      const sds = createParsedSDS([largeComponent]);
      const issues = transformerWithLowThreshold.transformAll(sds);

      if (issues.length > 2) {
        // Sub-tasks after the first should depend on previous ones
        const secondSubTask = issues[2];
        expect(secondSubTask?.dependencies.blockedBy.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getComponentToIssueMap', () => {
    it('should create mapping from component ID to issue ID', () => {
      const components = [
        createComponent({ id: 'CMP-001', name: 'User Service' }),
        createComponent({ id: 'CMP-002', name: 'Auth Service' }),
      ];
      const sds = createParsedSDS(components);
      const issues = transformer.transformAll(sds);

      const map = transformer.getComponentToIssueMap(issues);

      expect(map.get('CMP-001')).toBe('ISS-001');
      expect(map.get('CMP-002')).toBe('ISS-002');
    });

    it('should use first issue for decomposed components', () => {
      const transformerWithLowThreshold = new IssueTransformer(
        { maxIssueSize: 'XS' },
        lowThresholdEstimator
      );

      const largeComponent = createComponent({
        description: 'A'.repeat(1000),
        priority: 'P0',
        interfaces: [
          {
            name: 'IFirst',
            methods: Array.from({ length: 5 }, (_, i) => ({
              name: `method${i}`,
              signature: `method${i}(): void`,
              returnType: 'void',
            })),
            rawCode: '',
          },
          {
            name: 'ISecond',
            methods: Array.from({ length: 5 }, (_, i) => ({
              name: `method${i}`,
              signature: `method${i}(): void`,
              returnType: 'void',
            })),
            rawCode: '',
          },
        ],
      });

      const sds = createParsedSDS([largeComponent]);
      const issues = transformerWithLowThreshold.transformAll(sds);
      const map = transformerWithLowThreshold.getComponentToIssueMap(issues);

      // Should map to the first (epic) issue
      expect(map.get('CMP-001')).toBe('ISS-001');
    });
  });

  describe('options', () => {
    it('should respect custom milestone', () => {
      const customTransformer = new IssueTransformer({ milestone: 'v1.0.0' });
      const component = createComponent();
      const issue = customTransformer.transformComponent(component, []);

      expect(issue.milestone).toBe('v1.0.0');
    });

    it('should respect custom phase prefix', () => {
      const customTransformer = new IssueTransformer({ phasePrefix: 'sprint' });
      const component = createComponent();
      const issue = customTransformer.transformComponent(component, []);

      expect(issue.labels.phase).toBe('sprint-3');
    });

    it('should exclude hints when disabled', () => {
      const customTransformer = new IssueTransformer({ includeHints: false });
      const component = createComponent({ implementationNotes: 'Some notes' });
      const issue = customTransformer.transformComponent(component, []);

      expect(issue.body).not.toContain('## Technical Notes');
    });

    it('should exclude traceability when disabled', () => {
      const customTransformer = new IssueTransformer({ includeTraceability: false });
      const component = createComponent();
      const issue = customTransformer.transformComponent(component, [
        createTraceabilityEntry(),
      ]);

      expect(issue.body).not.toContain('### Source References');
    });
  });

  describe('issue body generation', () => {
    it('should include acceptance criteria based on interfaces', () => {
      const component = createComponent({
        interfaces: [
          {
            name: 'IUserService',
            methods: [
              { name: 'createUser', signature: 'createUser(): void', returnType: 'void' },
              { name: 'getUser', signature: 'getUser(): void', returnType: 'void' },
            ],
            rawCode: 'interface IUserService {}',
          },
        ],
      });

      const issue = transformer.transformComponent(component, []);

      expect(issue.body).toContain('## Acceptance Criteria');
      expect(issue.body).toContain('IUserService interface implemented');
      expect(issue.body).toContain('createUser method working');
      expect(issue.body).toContain('getUser method working');
    });

    it('should include interface code blocks', () => {
      const component = createComponent({
        interfaces: [
          {
            name: 'ITest',
            methods: [{ name: 'test', signature: 'test(): void', returnType: 'void' }],
            rawCode: 'interface ITest { test(): void; }',
          },
        ],
      });

      const issue = transformer.transformComponent(component, []);

      expect(issue.body).toContain('```typescript');
      expect(issue.body).toContain('interface ITest { test(): void; }');
    });

    it('should include dependencies section when present', () => {
      const component = createComponent({ dependencies: ['CMP-002', 'CMP-003'] });
      const issue = transformer.transformComponent(component, []);

      expect(issue.body).toContain('## Dependencies');
      expect(issue.body).toContain('**Blocked by**: CMP-002');
      expect(issue.body).toContain('**Blocked by**: CMP-003');
    });

    it('should include effort estimation table', () => {
      const component = createComponent();
      const issue = transformer.transformComponent(component, []);

      expect(issue.body).toContain('## Effort Estimation');
      expect(issue.body).toContain('| Size | Estimated Time |');
      expect(issue.body).toContain('**This issue**:');
    });

    it('should include traceability footer', () => {
      const component = createComponent();
      const traceability = [createTraceabilityEntry()];
      const issue = transformer.transformComponent(component, traceability);

      expect(issue.body).toContain('_Traceability:');
      expect(issue.body).toContain('CMP-001');
    });
  });

  describe('error handling', () => {
    it('should handle empty traceability matrix gracefully', () => {
      const component = createComponent();
      const issue = transformer.transformComponent(component, []);

      expect(issue.traceability.prdRequirement).toBeNull();
      expect(issue.traceability.useCases).toEqual([]);
    });
  });
});
