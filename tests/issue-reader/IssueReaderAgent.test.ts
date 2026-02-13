/**
 * IssueReaderAgent tests
 *
 * Tests for the CMP-028 Issue Reader Agent implementation.
 * Covers agent lifecycle, session management, issue importing,
 * dependency extraction, graph building, error handling, and singleton management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  IssueReaderAgent,
  getIssueReaderAgent,
  resetIssueReaderAgent,
  ISSUE_READER_AGENT_ID,
} from '../../src/issue-reader/IssueReaderAgent.js';

import { GhAuthError, IssueFetchError, OutputWriteError } from '../../src/issue-reader/errors.js';

import {
  DEFAULT_ISSUE_READER_CONFIG,
  PRIORITY_LABEL_MAP,
  DEFAULT_PRIORITY,
  EFFORT_LABEL_MAP,
  EFFORT_HOURS,
  TYPE_LABEL_KEYWORDS,
} from '../../src/issue-reader/types.js';

// Mock the security module
vi.mock('../../src/security/index.js', () => {
  const mockExecGhSync = vi.fn();

  return {
    getCommandSanitizer: () => ({
      execGhSync: mockExecGhSync,
    }),
    __mockExecGhSync: mockExecGhSync,
  };
});

// Import mock reference
import { __mockExecGhSync as mockExecGhSync } from '../../src/security/index.js';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function makeGhIssue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: 1,
    title: 'Test issue',
    body: 'Test body',
    state: 'OPEN',
    url: 'https://github.com/owner/repo/issues/1',
    labels: [],
    assignees: [],
    milestone: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function makeGhIssueList(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) =>
    makeGhIssue({
      number: i + 1,
      title: `Issue ${String(i + 1)}`,
      url: `https://github.com/owner/repo/issues/${String(i + 1)}`,
    })
  );
}

function mockAuthSuccess(): void {
  (mockExecGhSync as ReturnType<typeof vi.fn>).mockImplementation((args: string[]) => {
    if (args[0] === 'auth' && args[1] === 'status') {
      return { success: true, stdout: 'Logged in', stderr: '' };
    }
    // Default: return empty array for issue list
    return { success: true, stdout: '[]', stderr: '' };
  });
}

function mockAuthAndIssues(issues: unknown[]): void {
  (mockExecGhSync as ReturnType<typeof vi.fn>).mockImplementation((args: string[]) => {
    if (args[0] === 'auth' && args[1] === 'status') {
      return { success: true, stdout: 'Logged in', stderr: '' };
    }
    if (args[0] === 'issue' && args[1] === 'list') {
      return { success: true, stdout: JSON.stringify(issues), stderr: '' };
    }
    return { success: true, stdout: '', stderr: '' };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IssueReaderAgent', () => {
  let agent: IssueReaderAgent;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-reader-test-'));
    resetIssueReaderAgent();
    agent = new IssueReaderAgent({ scratchpadBasePath: path.join(tempDir, '.ad-sdlc/scratchpad') });
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    resetIssueReaderAgent();
  });

  // ---------------------------------------------------------------------------
  // Agent Identity and Interface
  // ---------------------------------------------------------------------------

  describe('Agent Identity', () => {
    it('should have correct agent ID', () => {
      expect(agent.agentId).toBe(ISSUE_READER_AGENT_ID);
      expect(agent.agentId).toBe('issue-reader-agent');
    });

    it('should have correct name', () => {
      expect(agent.name).toBe('Issue Reader Agent');
    });

    it('should implement IAgent interface', () => {
      expect(agent).toHaveProperty('agentId');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('initialize');
      expect(agent).toHaveProperty('dispose');
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  describe('Lifecycle', () => {
    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.toBeUndefined();
    });

    it('should be idempotent on repeated initialize', async () => {
      await agent.initialize();
      await expect(agent.initialize()).resolves.toBeUndefined();
    });

    it('should dispose and clear session', async () => {
      await agent.initialize();
      agent.startSession('owner/repo');
      expect(agent.getSession()).not.toBeNull();

      await agent.dispose();
      expect(agent.getSession()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  describe('Configuration', () => {
    it('should use default config when none provided', () => {
      const defaultAgent = new IssueReaderAgent();
      expect(defaultAgent).toBeDefined();
    });

    it('should have correct default values', () => {
      expect(DEFAULT_ISSUE_READER_CONFIG.scratchpadBasePath).toBe('.ad-sdlc/scratchpad');
      expect(DEFAULT_ISSUE_READER_CONFIG.ghCommandTimeoutMs).toBe(30_000);
      expect(DEFAULT_ISSUE_READER_CONFIG.defaultState).toBe('open');
      expect(DEFAULT_ISSUE_READER_CONFIG.maxIssues).toBe(500);
    });

    it('should allow config override', () => {
      const custom = new IssueReaderAgent({ maxIssues: 100 });
      expect(custom).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  describe('Session Management', () => {
    it('should start a session', () => {
      const session = agent.startSession('owner/repo');
      expect(session.sessionId).toBeDefined();
      expect(session.repository).toBe('owner/repo');
      expect(session.status).toBe('pending');
      expect(session.result).toBeNull();
      expect(session.errors).toHaveLength(0);
    });

    it('should return null when no session exists', () => {
      expect(agent.getSession()).toBeNull();
    });

    it('should return current session', () => {
      agent.startSession('owner/repo');
      const session = agent.getSession();
      expect(session).not.toBeNull();
      expect(session!.repository).toBe('owner/repo');
    });
  });

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const a = getIssueReaderAgent();
      const b = getIssueReaderAgent();
      expect(a).toBe(b);
    });

    it('should return new instance after reset', () => {
      const a = getIssueReaderAgent();
      resetIssueReaderAgent();
      const b = getIssueReaderAgent();
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // importIssues — Happy Path
  // ---------------------------------------------------------------------------

  describe('importIssues — Happy Path', () => {
    it('should import zero issues from empty repo', async () => {
      mockAuthSuccess();

      const result = await agent.importIssues('owner/repo');

      expect(result.repository).toBe('owner/repo');
      expect(result.issues).toHaveLength(0);
      expect(result.stats.total).toBe(0);
      expect(result.dependencyGraph.nodes).toHaveLength(0);
    });

    it('should import issues and assign sequential IDs', async () => {
      const issues = makeGhIssueList(3);
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues).toHaveLength(3);
      expect(result.issues[0].id).toBe('ISS-001');
      expect(result.issues[1].id).toBe('ISS-002');
      expect(result.issues[2].id).toBe('ISS-003');
    });

    it('should preserve GitHub issue metadata', async () => {
      const issues = [
        makeGhIssue({
          number: 42,
          title: 'Add feature X',
          body: 'Feature description',
          state: 'OPEN',
          labels: [{ name: 'enhancement' }],
          assignees: [{ login: 'alice' }],
          milestone: { title: 'Phase 1' },
        }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');
      const issue = result.issues[0];

      expect(issue.number).toBe(42);
      expect(issue.title).toBe('Add feature X');
      expect(issue.body).toBe('Feature description');
      expect(issue.state).toBe('open');
      expect(issue.assignees).toEqual(['alice']);
      expect(issue.milestone).toBe('Phase 1');
    });

    it('should auto-initialize if not initialized', async () => {
      mockAuthSuccess();
      // Agent was not initialized — importIssues should auto-init
      const result = await agent.importIssues('owner/repo');
      expect(result).toBeDefined();
    });

    it('should normalize full GitHub URL to owner/repo', async () => {
      mockAuthSuccess();

      const result = await agent.importIssues('https://github.com/owner/repo');

      expect(result.repository).toBe('owner/repo');
    });

    it('should normalize URL with .git suffix', async () => {
      mockAuthSuccess();

      const result = await agent.importIssues('https://github.com/owner/repo.git');

      expect(result.repository).toBe('owner/repo');
    });

    it('should update session status through lifecycle', async () => {
      mockAuthSuccess();

      await agent.importIssues('owner/repo');
      const session = agent.getSession();

      expect(session).not.toBeNull();
      expect(session!.status).toBe('completed');
      expect(session!.result).not.toBeNull();
    });

    it('should write output files to scratchpad', async () => {
      const issues = [makeGhIssue()];
      mockAuthAndIssues(issues);

      // Mock process.cwd to point to tempDir so scratchpad path resolves correctly
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
      const scratchAgent = new IssueReaderAgent();

      await scratchAgent.importIssues('owner/repo');

      const outputDir = path.join(tempDir, '.ad-sdlc/scratchpad', 'issues', 'owner_repo');
      expect(fs.existsSync(path.join(outputDir, 'issue_list.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'dependency_graph.json'))).toBe(true);

      cwdSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Label Mapping
  // ---------------------------------------------------------------------------

  describe('Label Mapping', () => {
    it('should map priority labels correctly', async () => {
      const issues = [
        makeGhIssue({ number: 1, labels: [{ name: 'priority-p0' }] }),
        makeGhIssue({ number: 2, labels: [{ name: 'priority-p1' }] }),
        makeGhIssue({ number: 3, labels: [{ name: 'low' }] }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].labels.priority).toBe('P0');
      expect(result.issues[1].labels.priority).toBe('P1');
      expect(result.issues[2].labels.priority).toBe('P3');
    });

    it('should default to P2 when no priority label exists', async () => {
      const issues = [makeGhIssue({ labels: [{ name: 'enhancement' }] })];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].labels.priority).toBe(DEFAULT_PRIORITY);
    });

    it('should map effort size labels', async () => {
      const issues = [
        makeGhIssue({ number: 1, labels: [{ name: 'size:XS' }] }),
        makeGhIssue({ number: 2, labels: [{ name: 'size:XL' }] }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].labels.size).toBe('XS');
      expect(result.issues[1].labels.size).toBe('XL');
    });

    it('should map type labels', async () => {
      const issues = [
        makeGhIssue({ number: 1, labels: [{ name: 'type/feature' }] }),
        makeGhIssue({ number: 2, labels: [{ name: 'bug' }] }),
        makeGhIssue({ number: 3, labels: [{ name: 'documentation' }] }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].labels.type).toBe('feature');
      expect(result.issues[1].labels.type).toBe('bug');
      expect(result.issues[2].labels.type).toBe('docs');
    });

    it('should estimate complexity from size', async () => {
      const issues = [
        makeGhIssue({ number: 1, labels: [{ name: 'size:S' }] }),
        makeGhIssue({ number: 2, labels: [{ name: 'size:M' }] }),
        makeGhIssue({ number: 3, labels: [{ name: 'size:L' }] }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].complexity).toBe('small');
      expect(result.issues[1].complexity).toBe('medium');
      expect(result.issues[2].complexity).toBe('large');
    });

    it('should compute estimated hours from size', async () => {
      const issues = [
        makeGhIssue({ number: 1, labels: [{ name: 'size:XS' }] }),
        makeGhIssue({ number: 2, labels: [{ name: 'size:XL' }] }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].estimatedHours).toBe(EFFORT_HOURS['XS']);
      expect(result.issues[1].estimatedHours).toBe(EFFORT_HOURS['XL']);
    });
  });

  // ---------------------------------------------------------------------------
  // Dependency Extraction
  // ---------------------------------------------------------------------------

  describe('Dependency Extraction', () => {
    it('should extract "depends on #N" pattern', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'Depends on #2' }),
        makeGhIssue({ number: 2, body: 'No deps' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].dependsOn).toEqual([2]);
      expect(result.issues[1].dependsOn).toEqual([]);
    });

    it('should extract "blocked by #N" pattern', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'Blocked by #2' }),
        makeGhIssue({ number: 2, body: '' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].dependsOn).toEqual([2]);
    });

    it('should extract "requires #N" pattern', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'This requires #2' }),
        makeGhIssue({ number: 2, body: '' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].dependsOn).toEqual([2]);
    });

    it('should extract "blocks #N" pattern', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'This blocks #2' }),
        makeGhIssue({ number: 2, body: '' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].blocks).toEqual([2]);
    });

    it('should ignore references to issues not in the import set', async () => {
      const issues = [makeGhIssue({ number: 1, body: 'Depends on #999' })];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].dependsOn).toEqual([]);
    });

    it('should extract multiple dependencies from one body', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'Depends on #2. Blocked by #3.' }),
        makeGhIssue({ number: 2, body: '' }),
        makeGhIssue({ number: 3, body: '' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].dependsOn).toContain(2);
      expect(result.issues[0].dependsOn).toContain(3);
    });

    it('should handle empty body gracefully', async () => {
      const issues = [makeGhIssue({ body: '' })];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.issues[0].dependsOn).toEqual([]);
      expect(result.issues[0].blocks).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Dependency Graph
  // ---------------------------------------------------------------------------

  describe('Dependency Graph', () => {
    it('should build graph with no dependencies', async () => {
      const issues = makeGhIssueList(3);
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');
      const graph = result.dependencyGraph;

      expect(graph.schemaVersion).toBe('1.0');
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(0);
      expect(graph.hasCycles).toBe(false);
      expect(graph.topologicalOrder).toHaveLength(3);
    });

    it('should build graph with linear dependency chain', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'Depends on #2' }),
        makeGhIssue({ number: 2, body: 'Depends on #3' }),
        makeGhIssue({ number: 3, body: '' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');
      const graph = result.dependencyGraph;

      expect(graph.edges.length).toBeGreaterThan(0);
      expect(graph.hasCycles).toBe(false);
      // ISS-003 must come before ISS-002, which must come before ISS-001
      const order = graph.topologicalOrder;
      expect(order.indexOf('ISS-003')).toBeLessThan(order.indexOf('ISS-002'));
      expect(order.indexOf('ISS-002')).toBeLessThan(order.indexOf('ISS-001'));
    });

    it('should detect circular dependencies', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'Depends on #2' }),
        makeGhIssue({ number: 2, body: 'Depends on #1' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');
      const graph = result.dependencyGraph;

      expect(graph.hasCycles).toBe(true);
      expect(graph.topologicalOrder).toHaveLength(0);
    });

    it('should mark cycle nodes as in_cycle', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'Depends on #2' }),
        makeGhIssue({ number: 2, body: 'Depends on #1' }),
        makeGhIssue({ number: 3, body: '' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');
      const graph = result.dependencyGraph;

      const node1 = graph.nodes.find((n) => n.githubNumber === 1);
      const node2 = graph.nodes.find((n) => n.githubNumber === 2);
      const node3 = graph.nodes.find((n) => n.githubNumber === 3);

      expect(node1!.status).toBe('in_cycle');
      expect(node2!.status).toBe('in_cycle');
      expect(node3!.status).toBe('ready');
    });

    it('should identify root nodes', async () => {
      const issues = [
        makeGhIssue({ number: 1, body: 'Depends on #2' }),
        makeGhIssue({ number: 2, body: '' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      // Issue #2 has no incoming dependencies, so it is a root
      expect(result.dependencyGraph.roots).toContain('ISS-002');
    });
  });

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  describe('Statistics', () => {
    it('should compute correct stats', async () => {
      const issues = [
        makeGhIssue({ number: 1, labels: [{ name: 'priority-p0' }, { name: 'size:S' }] }),
        makeGhIssue({ number: 2, labels: [{ name: 'priority-p1' }, { name: 'size:M' }] }),
        makeGhIssue({ number: 3, labels: [{ name: 'priority-p0' }], body: 'Depends on #1' }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.stats.total).toBe(3);
      expect(result.stats.imported).toBe(3);
      expect(result.stats.skipped).toBe(0);
      expect(result.stats.byPriority.P0).toBe(2);
      expect(result.stats.byPriority.P1).toBe(1);
      expect(result.stats.withDependencies).toBe(1);
    });

    it('should compute total estimated hours', async () => {
      const issues = [
        makeGhIssue({ number: 1, labels: [{ name: 'size:XS' }] }),
        makeGhIssue({ number: 2, labels: [{ name: 'size:L' }] }),
      ];
      mockAuthAndIssues(issues);

      const result = await agent.importIssues('owner/repo');

      expect(result.stats.totalEstimatedHours).toBe(EFFORT_HOURS['XS'] + EFFORT_HOURS['L']);
    });
  });

  // ---------------------------------------------------------------------------
  // Filtering Options
  // ---------------------------------------------------------------------------

  describe('Filtering Options', () => {
    it('should pass label filter to gh CLI', async () => {
      mockAuthSuccess();

      await agent.importIssues('owner/repo', { labels: ['bug', 'critical'] });

      const calls = (mockExecGhSync as ReturnType<typeof vi.fn>).mock.calls;
      const issueCall = calls.find((c: unknown[]) => (c[0] as string[])[0] === 'issue');
      expect(issueCall).toBeDefined();
      const args = issueCall![0] as string[];
      expect(args).toContain('--label');
      expect(args).toContain('bug');
      expect(args).toContain('critical');
    });

    it('should pass milestone filter to gh CLI', async () => {
      mockAuthSuccess();

      await agent.importIssues('owner/repo', { milestone: 'Phase 1' });

      const calls = (mockExecGhSync as ReturnType<typeof vi.fn>).mock.calls;
      const issueCall = calls.find((c: unknown[]) => (c[0] as string[])[0] === 'issue');
      const args = issueCall![0] as string[];
      expect(args).toContain('--milestone');
      expect(args).toContain('Phase 1');
    });

    it('should pass state filter to gh CLI', async () => {
      mockAuthSuccess();

      await agent.importIssues('owner/repo', { state: 'closed' });

      const calls = (mockExecGhSync as ReturnType<typeof vi.fn>).mock.calls;
      const issueCall = calls.find((c: unknown[]) => (c[0] as string[])[0] === 'issue');
      const args = issueCall![0] as string[];
      expect(args).toContain('--state');
      expect(args).toContain('closed');
    });

    it('should pass assignee filter to gh CLI', async () => {
      mockAuthSuccess();

      await agent.importIssues('owner/repo', { assignee: 'alice' });

      const calls = (mockExecGhSync as ReturnType<typeof vi.fn>).mock.calls;
      const issueCall = calls.find((c: unknown[]) => (c[0] as string[])[0] === 'issue');
      const args = issueCall![0] as string[];
      expect(args).toContain('--assignee');
      expect(args).toContain('alice');
    });

    it('should respect limit option', async () => {
      mockAuthSuccess();

      await agent.importIssues('owner/repo', { limit: 10 });

      const calls = (mockExecGhSync as ReturnType<typeof vi.fn>).mock.calls;
      const issueCall = calls.find((c: unknown[]) => (c[0] as string[])[0] === 'issue');
      const args = issueCall![0] as string[];
      expect(args).toContain('--limit');
      expect(args).toContain('10');
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should throw GhAuthError when not authenticated', async () => {
      (mockExecGhSync as ReturnType<typeof vi.fn>).mockReturnValue({
        success: false,
        stdout: '',
        stderr: 'not logged in',
      });

      await expect(agent.importIssues('owner/repo')).rejects.toThrow(GhAuthError);
    });

    it('should throw IssueFetchError when fetch fails', async () => {
      (mockExecGhSync as ReturnType<typeof vi.fn>).mockImplementation((args: string[]) => {
        if (args[0] === 'auth') {
          return { success: true, stdout: 'ok', stderr: '' };
        }
        return { success: false, stdout: '', stderr: 'repo not found' };
      });

      await expect(agent.importIssues('owner/repo')).rejects.toThrow(IssueFetchError);
    });

    it('should set session status to failed on error', async () => {
      (mockExecGhSync as ReturnType<typeof vi.fn>).mockReturnValue({
        success: false,
        stdout: '',
        stderr: 'auth failed',
      });

      await expect(agent.importIssues('owner/repo')).rejects.toThrow();

      const session = agent.getSession();
      expect(session).not.toBeNull();
      expect(session!.status).toBe('failed');
      expect(session!.errors.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Constants and Type Mappings
  // ---------------------------------------------------------------------------

  describe('Constants', () => {
    it('should define all priority mappings', () => {
      expect(PRIORITY_LABEL_MAP['critical']).toBe('P0');
      expect(PRIORITY_LABEL_MAP['priority-p0']).toBe('P0');
      expect(PRIORITY_LABEL_MAP['high']).toBe('P1');
      expect(PRIORITY_LABEL_MAP['medium']).toBe('P2');
      expect(PRIORITY_LABEL_MAP['low']).toBe('P3');
    });

    it('should define all effort mappings', () => {
      expect(EFFORT_LABEL_MAP['size:XS']).toBe('XS');
      expect(EFFORT_LABEL_MAP['size:S']).toBe('S');
      expect(EFFORT_LABEL_MAP['size:M']).toBe('M');
      expect(EFFORT_LABEL_MAP['size:L']).toBe('L');
      expect(EFFORT_LABEL_MAP['size:XL']).toBe('XL');
    });

    it('should define effort hours for all sizes', () => {
      expect(EFFORT_HOURS['XS']).toBe(2);
      expect(EFFORT_HOURS['S']).toBe(4);
      expect(EFFORT_HOURS['M']).toBe(6);
      expect(EFFORT_HOURS['L']).toBe(12);
      expect(EFFORT_HOURS['XL']).toBe(20);
    });

    it('should define type keywords', () => {
      expect(TYPE_LABEL_KEYWORDS['feature']).toBe('feature');
      expect(TYPE_LABEL_KEYWORDS['bug']).toBe('bug');
      expect(TYPE_LABEL_KEYWORDS['documentation']).toBe('docs');
    });
  });

  // ---------------------------------------------------------------------------
  // Module Exports
  // ---------------------------------------------------------------------------

  describe('Module Exports', () => {
    it('should export from barrel file', async () => {
      const barrelPath = path.resolve(__dirname, '../../src/issue-reader/index.ts');
      const source = await fs.promises.readFile(barrelPath, 'utf-8');

      expect(source).toContain('IssueReaderAgent');
      expect(source).toContain('getIssueReaderAgent');
      expect(source).toContain('resetIssueReaderAgent');
      expect(source).toContain('ISSUE_READER_AGENT_ID');
      expect(source).toContain('IssueReaderError');
      expect(source).toContain('GhAuthError');
      expect(source).toContain('IssueFetchError');
      expect(source).toContain('CircularDependencyError');
      expect(source).toContain('DEFAULT_ISSUE_READER_CONFIG');
    });

    it('should be registered in agents/index.ts', async () => {
      const agentsPath = path.resolve(__dirname, '../../src/agents/index.ts');
      const source = await fs.promises.readFile(agentsPath, 'utf-8');

      expect(source).toContain("export * as IssueReader from '../issue-reader/index.js'");
    });
  });
});
