/**
 * WorkerAgent result YAML and commit messages: values must reach the YAML
 * reader and git unchanged (kcenon/claude_code_agent#973).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as yaml from 'js-yaml';
import { WorkerAgent } from '../../src/worker/index.js';
import type { ImplementationResult } from '../../src/worker/index.js';

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
  });
});
