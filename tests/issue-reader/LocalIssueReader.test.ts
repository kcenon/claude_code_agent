/**
 * LocalIssueReader unit tests
 *
 * Tests local file-based issue reading as an alternative to GitHub import.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalIssueReader } from '../../src/issue-reader/LocalIssueReader.js';
import { LocalIssueFileNotFoundError } from '../../src/issue-reader/errors.js';

describe('LocalIssueReader', () => {
  let reader: LocalIssueReader;
  let tmpDir: string;

  beforeEach(() => {
    reader = new LocalIssueReader();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-issue-reader-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('agent identity', () => {
    it('should have correct agentId', () => {
      expect(reader.agentId).toBe('local-issue-reader');
    });

    it('should have correct name', () => {
      expect(reader.name).toBe('Local Issue Reader');
    });

    it('should implement initialize/dispose', async () => {
      await expect(reader.initialize()).resolves.not.toThrow();
      await expect(reader.dispose()).resolves.not.toThrow();
    });
  });

  describe('importFromLocal', () => {
    it('should throw LocalIssueFileNotFoundError when issue_list.json is missing', async () => {
      await expect(reader.importFromLocal(tmpDir)).rejects.toThrow(LocalIssueFileNotFoundError);
    });

    it('should read a valid issue_list.json', async () => {
      const issueList = {
        schema_version: '1.0',
        issues: [
          {
            id: 'ISS-001',
            number: 1,
            title: 'Implement auth',
            body: 'Add JWT authentication',
            state: 'open',
            labels: { raw: ['feature'], priority: 'P1', type: 'feature', size: 'M' },
            dependencies: { blocked_by: [], blocks: ['ISS-002'] },
            estimation: { size: 'M', hours: 6 },
          },
          {
            id: 'ISS-002',
            number: 2,
            title: 'Add API endpoint',
            body: 'Create REST endpoint',
            state: 'open',
            labels: { raw: ['feature'], priority: 'P2', type: 'feature', size: 'S' },
            dependencies: { blocked_by: ['ISS-001'], blocks: [] },
            estimation: { size: 'S', hours: 4 },
          },
        ],
      };

      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), JSON.stringify(issueList));

      const result = await reader.importFromLocal(tmpDir);

      expect(result.repository).toBe('local');
      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].id).toBe('ISS-001');
      expect(result.issues[0].title).toBe('Implement auth');
      expect(result.issues[1].labels.priority).toBe('P2');
      expect(result.stats.total).toBe(2);
      expect(result.stats.totalEstimatedHours).toBe(10);
    });

    it('should auto-generate dependency_graph.json when missing', async () => {
      const issueList = {
        issues: [
          {
            id: 'ISS-001',
            number: 1,
            title: 'Base task',
            labels: { priority: 'P0', type: 'feature', size: 'S' },
            dependencies: { blocked_by: [], blocks: [] },
          },
          {
            id: 'ISS-002',
            number: 2,
            title: 'Dependent task',
            labels: { priority: 'P1', type: 'feature', size: 'M' },
            dependencies: { blocked_by: [1], blocks: [] },
          },
        ],
      };

      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), JSON.stringify(issueList));

      const result = await reader.importFromLocal(tmpDir);

      expect(result.dependencyGraph).toBeDefined();
      expect(result.dependencyGraph.nodes).toHaveLength(2);
      expect(result.dependencyGraph.edges).toHaveLength(1);
      expect(result.dependencyGraph.hasCycles).toBe(false);
      expect(result.dependencyGraph.topologicalOrder).toHaveLength(2);
      expect(result.dependencyGraph.topologicalOrder[0]).toBe('ISS-001');
    });

    it('should read existing dependency_graph.json when present', async () => {
      const issueList = {
        issues: [{ id: 'ISS-001', number: 1, title: 'Task', labels: {}, dependencies: {} }],
      };
      const depGraph = {
        schemaVersion: '1.0',
        generatedAt: '2025-01-01T00:00:00Z',
        nodes: [
          {
            id: 'ISS-001',
            githubNumber: 1,
            title: 'Task',
            priority: 'P2',
            size: 'M',
            status: 'ready',
          },
        ],
        edges: [],
        roots: ['ISS-001'],
        leaves: ['ISS-001'],
        hasCycles: false,
        topologicalOrder: ['ISS-001'],
      };

      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), JSON.stringify(issueList));
      fs.writeFileSync(path.join(tmpDir, 'dependency_graph.json'), JSON.stringify(depGraph));

      const result = await reader.importFromLocal(tmpDir);

      expect(result.dependencyGraph.schemaVersion).toBe('1.0');
      expect(result.dependencyGraph.nodes).toHaveLength(1);
    });

    it('should handle empty issue list', async () => {
      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), JSON.stringify({ issues: [] }));

      const result = await reader.importFromLocal(tmpDir);

      expect(result.issues).toHaveLength(0);
      expect(result.stats.total).toBe(0);
      expect(result.dependencyGraph.nodes).toHaveLength(0);
    });

    it('should handle ISS-NNN dependency format', async () => {
      const issueList = {
        issues: [
          { id: 'ISS-001', number: 1, title: 'First', labels: {}, dependencies: {} },
          {
            id: 'ISS-002',
            number: 2,
            title: 'Second',
            labels: {},
            dependencies: { blocked_by: ['ISS-001'] },
          },
        ],
      };

      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), JSON.stringify(issueList));

      const result = await reader.importFromLocal(tmpDir);

      expect(result.issues[1].dependsOn).toContain(1);
      expect(result.dependencyGraph.edges).toHaveLength(1);
    });

    it('should detect circular dependencies', async () => {
      const issueList = {
        issues: [
          { id: 'ISS-001', number: 1, title: 'A', labels: {}, dependencies: { blocked_by: [2] } },
          { id: 'ISS-002', number: 2, title: 'B', labels: {}, dependencies: { blocked_by: [1] } },
        ],
      };

      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), JSON.stringify(issueList));

      const result = await reader.importFromLocal(tmpDir);

      expect(result.dependencyGraph.hasCycles).toBe(true);
      expect(result.dependencyGraph.topologicalOrder).toHaveLength(0);
    });

    it('should compute statistics correctly', async () => {
      const issueList = {
        issues: [
          {
            id: 'ISS-001',
            number: 1,
            title: 'A',
            labels: { priority: 'P0' },
            dependencies: {},
            estimation: { hours: 10 },
          },
          {
            id: 'ISS-002',
            number: 2,
            title: 'B',
            labels: { priority: 'P1' },
            dependencies: { blocked_by: [1] },
            estimation: { hours: 5 },
          },
          {
            id: 'ISS-003',
            number: 3,
            title: 'C',
            labels: { priority: 'P1' },
            dependencies: {},
            estimation: { hours: 8 },
          },
        ],
      };

      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), JSON.stringify(issueList));

      const result = await reader.importFromLocal(tmpDir);

      expect(result.stats.byPriority.P0).toBe(1);
      expect(result.stats.byPriority.P1).toBe(2);
      expect(result.stats.withDependencies).toBe(1);
      expect(result.stats.totalEstimatedHours).toBe(23);
    });

    it('should reject invalid JSON', async () => {
      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), 'not json');

      await expect(reader.importFromLocal(tmpDir)).rejects.toThrow('Failed to parse');
    });

    it('should reject missing issues array', async () => {
      fs.writeFileSync(path.join(tmpDir, 'issue_list.json'), JSON.stringify({ data: 'no issues' }));

      await expect(reader.importFromLocal(tmpDir)).rejects.toThrow('expected "issues" array');
    });
  });
});
