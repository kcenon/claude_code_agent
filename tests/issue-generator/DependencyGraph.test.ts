import { describe, it, expect } from 'vitest';
import {
  DependencyGraphBuilder,
  SDSComponent,
  CircularDependencyError,
  ComponentNotFoundError,
} from '../../src/issue-generator/index.js';

describe('DependencyGraphBuilder', () => {
  const builder = new DependencyGraphBuilder();

  const createComponent = (
    id: string,
    dependencies: string[] = []
  ): SDSComponent => ({
    id,
    name: `Component ${id}`,
    responsibility: 'Test responsibility',
    sourceFeature: null,
    priority: 'P1',
    description: 'Test description',
    interfaces: [],
    dependencies,
    implementationNotes: '',
  });

  const createMapping = (
    components: SDSComponent[]
  ): Map<string, string> => {
    const map = new Map<string, string>();
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (component) {
        map.set(component.id, `ISS-${String(i + 1).padStart(3, '0')}`);
      }
    }
    return map;
  };

  describe('build', () => {
    it('should build graph with no dependencies', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002'),
      ];
      const mapping = createMapping(components);

      const graph = builder.build(components, mapping);

      expect(graph.nodes.length).toBe(2);
      expect(graph.edges.length).toBe(0);
      expect(graph.executionOrder.length).toBe(2);
    });

    it('should build graph with linear dependencies', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002', ['CMP-001']),
        createComponent('CMP-003', ['CMP-002']),
      ];
      const mapping = createMapping(components);

      const graph = builder.build(components, mapping);

      expect(graph.nodes.length).toBe(3);
      expect(graph.edges.length).toBe(2);

      // CMP-001 should come first in execution order
      const issueOrder = graph.executionOrder;
      expect(issueOrder.indexOf('ISS-001')).toBeLessThan(
        issueOrder.indexOf('ISS-002')
      );
      expect(issueOrder.indexOf('ISS-002')).toBeLessThan(
        issueOrder.indexOf('ISS-003')
      );
    });

    it('should build parallel groups', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002'),
        createComponent('CMP-003', ['CMP-001', 'CMP-002']),
      ];
      const mapping = createMapping(components);

      const graph = builder.build(components, mapping);

      expect(graph.parallelGroups.length).toBe(2);
      expect(graph.parallelGroups[0]?.issueIds).toContain('ISS-001');
      expect(graph.parallelGroups[0]?.issueIds).toContain('ISS-002');
      expect(graph.parallelGroups[1]?.issueIds).toContain('ISS-003');
    });

    it('should calculate node depths correctly', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002', ['CMP-001']),
        createComponent('CMP-003', ['CMP-002']),
      ];
      const mapping = createMapping(components);

      const graph = builder.build(components, mapping);

      const node1 = graph.nodes.find((n) => n.id === 'ISS-001');
      const node2 = graph.nodes.find((n) => n.id === 'ISS-002');
      const node3 = graph.nodes.find((n) => n.id === 'ISS-003');

      expect(node1?.depth).toBe(0);
      expect(node2?.depth).toBe(1);
      expect(node3?.depth).toBe(2);
    });

    it('should throw CircularDependencyError for cycles', () => {
      const components = [
        createComponent('CMP-001', ['CMP-003']),
        createComponent('CMP-002', ['CMP-001']),
        createComponent('CMP-003', ['CMP-002']),
      ];
      const mapping = createMapping(components);

      expect(() => builder.build(components, mapping)).toThrow(
        CircularDependencyError
      );
    });

    it('should throw ComponentNotFoundError for missing mapping', () => {
      const components = [createComponent('CMP-001')];
      const mapping = new Map<string, string>();

      expect(() => builder.build(components, mapping)).toThrow(
        ComponentNotFoundError
      );
    });
  });

  describe('getDependencies', () => {
    it('should return direct dependencies', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002', ['CMP-001']),
      ];
      const mapping = createMapping(components);

      builder.build(components, mapping);

      const deps = builder.getDependencies('ISS-002');
      expect(deps).toContain('ISS-001');
    });

    it('should return empty array for node without dependencies', () => {
      const components = [createComponent('CMP-001')];
      const mapping = createMapping(components);

      builder.build(components, mapping);

      const deps = builder.getDependencies('ISS-001');
      expect(deps).toEqual([]);
    });
  });

  describe('getDependents', () => {
    it('should return direct dependents', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002', ['CMP-001']),
      ];
      const mapping = createMapping(components);

      builder.build(components, mapping);

      const dependents = builder.getDependents('ISS-001');
      expect(dependents).toContain('ISS-002');
    });
  });

  describe('dependsOn', () => {
    it('should detect direct dependency', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002', ['CMP-001']),
      ];
      const mapping = createMapping(components);

      builder.build(components, mapping);

      expect(builder.dependsOn('ISS-002', 'ISS-001')).toBe(true);
      expect(builder.dependsOn('ISS-001', 'ISS-002')).toBe(false);
    });

    it('should detect transitive dependency', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002', ['CMP-001']),
        createComponent('CMP-003', ['CMP-002']),
      ];
      const mapping = createMapping(components);

      builder.build(components, mapping);

      expect(builder.dependsOn('ISS-003', 'ISS-001')).toBe(true);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return all transitive dependencies', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002', ['CMP-001']),
        createComponent('CMP-003', ['CMP-002']),
      ];
      const mapping = createMapping(components);

      builder.build(components, mapping);

      const deps = builder.getTransitiveDependencies('ISS-003');
      expect(deps).toContain('ISS-001');
      expect(deps).toContain('ISS-002');
      expect(deps.length).toBe(2);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      const components = [
        createComponent('CMP-001'),
        createComponent('CMP-002', ['CMP-001']),
        createComponent('CMP-003', ['CMP-002']),
      ];
      const mapping = createMapping(components);

      builder.build(components, mapping);

      const stats = builder.getStatistics();

      expect(stats.totalNodes).toBe(3);
      expect(stats.totalEdges).toBe(2);
      expect(stats.maxDepth).toBe(2);
      expect(stats.rootNodes).toBe(1);
      expect(stats.leafNodes).toBe(1);
    });
  });
});
