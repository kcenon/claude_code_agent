/**
 * WorkerAgent result YAML and commit messages: values must reach the YAML
 * reader and git unchanged (kcenon/claude_code_agent#973).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as yaml from 'js-yaml';
import { getCommandSanitizer } from '../../src/security/index.js';
import { WorkerAgent } from '../../src/worker/index.js';
import type { ImplementationResult, WorkOrder } from '../../src/worker/index.js';

describe('WorkerAgent persistence', () => {
  let projectDir: string;
  let agent: WorkerAgent;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'worker-persistence-'));
    agent = new WorkerAgent({ projectRoot: projectDir, resultsPath: 'progress' });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  function result(verification: Partial<ImplementationResult['verification']>, notes?: string) {
    const base: ImplementationResult = {
      workOrderId: 'WO-900',
      issueId: 'ISS-900',
      status: 'completed',
      startedAt: '2026-10-23T00:00:00.000Z',
      completedAt: '2026-10-23T00:01:00.000Z',
      changes: [],
      tests: { filesCreated: [], totalTests: 0, coveragePercentage: 0 },
      verification: {
        testsPassed: true,
        testsOutput: '',
        lintPassed: true,
        lintOutput: '',
        buildPassed: true,
        buildOutput: '',
        ...verification,
      },
      branch: { name: 'feature/iss-900', commits: [] },
    };
    return notes === undefined ? base : { ...base, notes };
  }

  async function saved(value: ImplementationResult): Promise<{ text: string; parsed: unknown }> {
    await agent.saveResult(value);
    const text = await readFile(
      join(projectDir, 'progress', 'results', 'WO-900-result.yaml'),
      'utf-8'
    );
    return {
      text,
      parsed: (yaml.load(text) as { implementation_result: unknown }).implementation_result,
    };
  }

  describe('result YAML', () => {
    it('should quote strings with YAML indicators and read them back unchanged', async () => {
      const value = result(
        {
          testsOutput: 'Test output: passed # comment',
          lintOutput: 'Output with "quotes"',
          buildOutput: '"Leading quote" and: colon',
        },
        'Note with: colon'
      );

      const { text, parsed } = await saved(value);

      expect(text).toContain('    testsOutput: "Test output: passed # comment"\n');
      expect(text).toContain('    lintOutput: Output with "quotes"\n');
      expect(text).toContain('    buildOutput: "\\"Leading quote\\" and: colon"\n');
      expect(text).toContain('  notes: "Note with: colon"\n');
      expect(parsed).toMatchObject({
        notes: 'Note with: colon',
        verification: {
          testsOutput: 'Test output: passed # comment',
          lintOutput: 'Output with "quotes"',
          buildOutput: '"Leading quote" and: colon',
        },
      });
    });

    it('should write plain strings, numbers, and booleans unquoted', async () => {
      const { text } = await saved(result({ testsOutput: 'All 12 tests passed' }));

      expect(text).toContain('  workOrderId: WO-900\n');
      expect(text).toContain('    testsPassed: true\n');
      expect(text).toContain('    totalTests: 0\n');
      expect(text).toContain('    testsOutput: All 12 tests passed\n');
    });

    it('should keep backslashes in quoted strings', async () => {
      const verification = {
        testsOutput: 'FAIL C:\\temp\\new.ts: expected "\\d+"',
        buildOutput: 'path: \\\\server\\share\\',
      };

      const { parsed } = await saved(result(verification));

      expect(parsed).toMatchObject({ verification });
    });

    it('should keep line breaks and repeated quotes in quoted strings', async () => {
      const verification = {
        testsOutput: 'Line 1\nLine 2: "a" and "b"\n\n  indented # not a comment',
        lintOutput: '"""triple"""\r\nnext',
      };

      const { text, parsed } = await saved(result(verification));

      expect(parsed).toMatchObject({ verification });
      expect(text.split('\n').filter((line) => line.startsWith('    testsOutput: '))).toEqual([
        '    testsOutput: "Line 1\\nLine 2: \\"a\\" and \\"b\\"\\n\\n  indented # not a comment"',
      ]);
    });
  });

  describe('commitChanges', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    /**
     * Run commitChanges against a git double and return the arguments of each call.
     * @param order - Work order whose message is committed
     * @returns Argument arrays passed to CommandSanitizer.execGit
     */
    async function gitCalls(order: WorkOrder): Promise<string[][]> {
      const execGit = vi
        .spyOn(getCommandSanitizer(), 'execGit')
        .mockImplementation(async (args: string[]) => ({
          success: true,
          stdout: args[0] === 'status' ? ' M feature.ts\n' : args[0] === 'rev-parse' ? 'abc\n' : '',
          stderr: '',
          command: 'git',
        }));
      await agent.commitChanges(order);
      return execGit.mock.calls.map(([args]) => args);
    }

    it('should pass the formatted message to git as one argument', async () => {
      const calls = await gitCalls(workOrder('ISS-901-add-login', 'auth'));

      expect(calls).toEqual([
        ['add', '-A'],
        ['status', '--porcelain'],
        ['commit', '-m', 'feat(auth): implement add login\n\nRefs: #ISS-901-add-login'],
        ['rev-parse', 'HEAD'],
      ]);
    });

    it('should keep double quotes and backslashes in the commit message', async () => {
      const calls = await gitCalls(workOrder('ISS-902', 'say "hi" C:\\temp\\'));

      expect(calls[2]).toEqual([
        'commit',
        '-m',
        'feat(say "hi" C:\\temp\\): implement ISS-902\n\nRefs: #ISS-902',
      ]);
    });
  });
});

function workOrder(issueId: string, sdsComponent: string): WorkOrder {
  return {
    orderId: 'WO-901',
    issueId,
    createdAt: '2026-10-23T00:00:00.000Z',
    priority: 50,
    context: { relatedFiles: [], dependenciesStatus: [], sdsComponent },
    acceptanceCriteria: [],
  };
}
