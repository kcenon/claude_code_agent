import { describe, it, expect } from 'vitest';
import {
  EffortEstimator,
  SDSComponent,
  EstimationError,
} from '../../src/issue-generator/index.js';

describe('EffortEstimator', () => {
  const estimator = new EffortEstimator();

  const createComponent = (
    overrides: Partial<SDSComponent> = {}
  ): SDSComponent => ({
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

  describe('estimate', () => {
    it('should return XS for simple component', () => {
      const component = createComponent({
        description: 'Simple task',
        interfaces: [],
        dependencies: [],
      });

      const result = estimator.estimate(component);

      expect(result.size).toBe('XS');
      expect(result.hours).toBe(2);
    });

    it('should return larger size for complex component', () => {
      const component = createComponent({
        description: 'A'.repeat(600),
        implementationNotes: 'B'.repeat(400),
        priority: 'P0',
        interfaces: [
          {
            name: 'IComplexInterface',
            methods: [
              { name: 'method1', signature: 'method1(): void', returnType: 'void' },
              { name: 'method2', signature: 'method2(): Promise<string>', returnType: 'Promise<string>' },
              { name: 'method3', signature: 'method3(): Record<string, number>', returnType: 'Record<string, number>' },
              { name: 'method4', signature: 'method4(): void', returnType: 'void' },
              { name: 'method5', signature: 'method5(): void', returnType: 'void' },
            ],
            rawCode: 'interface IComplexInterface {}',
          },
        ],
        dependencies: ['CMP-002', 'CMP-003', 'CMP-004'],
      });

      const result = estimator.estimate(component);

      expect(['M', 'L', 'XL']).toContain(result.size);
      expect(result.hours).toBeGreaterThan(4);
    });

    it('should include estimation factors', () => {
      const component = createComponent({
        interfaces: [
          {
            name: 'ITest',
            methods: [
              { name: 'test', signature: 'test(): void', returnType: 'void' },
            ],
            rawCode: 'interface ITest {}',
          },
        ],
        dependencies: ['CMP-002'],
      });

      const result = estimator.estimate(component);

      expect(result.factors.interfaceCount).toBe(1);
      expect(result.factors.dependencyCount).toBe(1);
      expect(result.factors.methodCount).toBe(1);
      expect(result.factors.complexity).toBeGreaterThanOrEqual(1);
    });

    it('should account for P0 priority', () => {
      const p0Component = createComponent({ priority: 'P0' });
      const p3Component = createComponent({ priority: 'P3' });

      const p0Result = estimator.estimate(p0Component);
      const p3Result = estimator.estimate(p3Component);

      expect(p0Result.factors.complexity).toBeGreaterThanOrEqual(
        p3Result.factors.complexity
      );
    });
  });

  describe('estimateAll', () => {
    it('should estimate multiple components', () => {
      const components = [
        createComponent({ id: 'CMP-001' }),
        createComponent({ id: 'CMP-002' }),
        createComponent({ id: 'CMP-003' }),
      ];

      const results = estimator.estimateAll(components);

      expect(results.size).toBe(3);
      expect(results.has('CMP-001')).toBe(true);
      expect(results.has('CMP-002')).toBe(true);
      expect(results.has('CMP-003')).toBe(true);
    });
  });

  describe('shouldDecompose', () => {
    it('should return false for small components', () => {
      const component = createComponent();
      const result = estimator.shouldDecompose(component);

      expect(result).toBe(false);
    });

    it('should return true for XL components when max is XS', () => {
      const component = createComponent({
        description: 'A'.repeat(1000),
        implementationNotes: 'B'.repeat(500),
        priority: 'P0',
        interfaces: [
          {
            name: 'IHuge',
            methods: Array.from({ length: 20 }, (_, i) => ({
              name: `method${i}`,
              signature: `method${i}(): Promise<object>`,
              returnType: 'Promise<object>',
            })),
            rawCode: 'interface IHuge {}',
          },
        ],
        dependencies: ['CMP-002', 'CMP-003', 'CMP-004', 'CMP-005'],
      });

      // Test that complex components are flagged when max size is very small
      const result = estimator.shouldDecompose(component, 'XS');

      expect(result).toBe(true);
    });
  });

  describe('suggestDecomposition', () => {
    it('should return null for small components', () => {
      const component = createComponent();
      const suggestions = estimator.suggestDecomposition(component);

      expect(suggestions).toBeNull();
    });

    it('should suggest splitting by interface for large components', () => {
      // Create a custom estimator with lower thresholds to trigger decomposition
      const lowThresholdEstimator = new EffortEstimator({
        thresholds: { xs: 1, s: 2, m: 3, l: 4 },
      });

      const component = createComponent({
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
        dependencies: ['CMP-002', 'CMP-003'],
      });

      const suggestions = lowThresholdEstimator.suggestDecomposition(component);

      expect(suggestions).not.toBeNull();
      expect(suggestions?.some((s) => s.includes('IInterface1'))).toBe(true);
      expect(suggestions?.some((s) => s.includes('IInterface2'))).toBe(true);
    });
  });

  describe('getSizeDescription', () => {
    it('should return description for each size', () => {
      expect(EffortEstimator.getSizeDescription('XS')).toContain('2 hours');
      expect(EffortEstimator.getSizeDescription('S')).toContain('2-4 hours');
      expect(EffortEstimator.getSizeDescription('M')).toContain('4-8 hours');
      expect(EffortEstimator.getSizeDescription('L')).toContain('1-2 days');
      expect(EffortEstimator.getSizeDescription('XL')).toContain('2 days');
    });
  });

  describe('custom options', () => {
    it('should respect custom thresholds', () => {
      const customEstimator = new EffortEstimator({
        thresholds: { xs: 1, s: 2, m: 3, l: 4 },
      });

      const component = createComponent({ priority: 'P0' });
      const result = customEstimator.estimate(component);

      expect(['S', 'M', 'L', 'XL']).toContain(result.size);
    });

    it('should throw on invalid weights', () => {
      expect(
        () =>
          new EffortEstimator({
            weights: { complexity: 0.5, interfaces: 0.1, dependencies: 0.1, methods: 0.1 },
          })
      ).toThrow(EstimationError);
    });
  });
});
