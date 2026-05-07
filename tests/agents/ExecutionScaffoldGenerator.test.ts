/**
 * Tests for ExecutionScaffoldGenerator
 *
 * Verifies that all 4 execution stages produce meaningful scaffold output
 * in local+stub mode: controller → work orders, worker → source stubs,
 * validation → V&V report, review → review document.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ExecutionScaffoldGenerator } from '../../src/agents/ExecutionScaffoldGenerator.js';
import type { OrchestratorSession } from '../../src/ad-sdlc-orchestrator/types.js';
import type { LocalIssueListFile } from '../../src/issue-generator/LocalIssueWriter.js';

function createTestSession(projectDir: string, scratchpadDir: string): OrchestratorSession {
  return {
    sessionId: 'test-session',
    projectDir,
    userRequest: 'Build a note manager',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir,
    localMode: true,
  };
}

/**
 * Write a minimal issue_list.json matching LocalIssueWriter output format.
 */
async function writeTestIssueList(issueDir: string, count: number = 3): Promise<void> {
  await mkdir(issueDir, { recursive: true });

  const issues = Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const id = `ISS-${String(n).padStart(3, '0')}`;
    return {
      id,
      number: n,
      url: `local://issues/${id}`,
      title: `[Feature] Feature ${n}`,
      body: [
        '## Description',
        `Implement feature ${n}`,
        '',
        '## Acceptance Criteria',
        `- [ ] AC-${n}-1: Must work correctly`,
        `- [ ] AC-${n}-2: Must handle edge cases`,
        '',
        '## Traceability',
        `- SRS Feature: SF-00${n}`,
      ].join('\n'),
      state: 'open',
      labels: {
        raw: ['type/feature', 'priority/p2'],
        priority: 'P2',
        type: 'feature',
        size: 'M',
      },
      milestone: null,
      assignees: [],
      dependencies: { blocked_by: [], blocks: [] },
      estimation: { size: 'M', hours: 6 },
    };
  });

  const issueList: LocalIssueListFile = {
    schemaVersion: '1.0.0',
    projectId: 'test-project',
    generatedAt: new Date().toISOString(),
    issues,
  };

  await writeFile(join(issueDir, 'issue_list.json'), JSON.stringify(issueList, null, 2), 'utf-8');
}

describe('ExecutionScaffoldGenerator', () => {
  let tmpDir: string;
  let projectDir: string;
  let scratchpadDir: string;
  let session: OrchestratorSession;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'scaffold-test-'));
    projectDir = join(tmpDir, 'test-project');
    scratchpadDir = join(tmpDir, 'scratchpad');
    await mkdir(projectDir, { recursive: true });
    await mkdir(scratchpadDir, { recursive: true });
    session = createTestSession(projectDir, scratchpadDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------
  // Controller Stage
  // --------------------------------------------------------------------------

  describe('controller', () => {
    it('should generate work order files from issue_list.json', async () => {
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await writeTestIssueList(issueDir, 3);

      const result = JSON.parse(await ExecutionScaffoldGenerator.controller(session));

      expect(result.stage).toBe('controller');
      expect(result.scaffold).toBe(true);
      expect(result.workOrderCount).toBe(3);
      expect(result.workOrders).toHaveLength(3);
      expect(result.workOrders[0].orderId).toBe('WO-ISS-001');
    });

    it('should write valid WO-*.json files to the work_orders directory', async () => {
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await writeTestIssueList(issueDir, 2);

      const result = JSON.parse(await ExecutionScaffoldGenerator.controller(session));

      const files = await readdir(result.workOrderDir);
      expect(files).toContain('WO-ISS-001.json');
      expect(files).toContain('WO-ISS-002.json');

      // Verify work order content
      const wo = JSON.parse(await readFile(join(result.workOrderDir, 'WO-ISS-001.json'), 'utf-8'));
      expect(wo.orderId).toBe('WO-ISS-001');
      expect(wo.issueId).toBe('ISS-001');
      expect(wo.title).toBe('[Feature] Feature 1');
      expect(wo.priority).toBe(50); // P2 = 50
      expect(wo.acceptanceCriteria).toHaveLength(2);
      expect(wo.acceptanceCriteria[0]).toContain('Must work correctly');
    });

    it('should return empty work orders when issue_list.json is missing', async () => {
      const result = JSON.parse(await ExecutionScaffoldGenerator.controller(session));

      expect(result.workOrderCount).toBe(0);
      expect(result.workOrders).toHaveLength(0);
    });

    it('should sanitize issue IDs to prevent path traversal', async () => {
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await mkdir(issueDir, { recursive: true });

      const issueList: LocalIssueListFile = {
        schemaVersion: '1.0.0',
        projectId: 'test-project',
        generatedAt: new Date().toISOString(),
        issues: [
          {
            id: '../../../etc/passwd',
            number: 1,
            url: 'local://issues/malicious',
            title: '[Feature] Malicious',
            body: '',
            state: 'open',
            labels: { raw: [], priority: 'P2', type: 'feature', size: 'M' },
            milestone: null,
            assignees: [],
            dependencies: { blocked_by: [], blocks: [] },
            estimation: { size: 'M', hours: 6 },
          },
        ],
      };

      await writeFile(join(issueDir, 'issue_list.json'), JSON.stringify(issueList), 'utf-8');

      const result = JSON.parse(await ExecutionScaffoldGenerator.controller(session));

      // Sanitized: ../../../etc/passwd → _________etc_passwd (dots and slashes become _)
      expect(result.workOrders[0].issueId).toBe('_________etc_passwd');
      expect(result.workOrders[0].orderId).toBe('WO-_________etc_passwd');

      // File should be safely inside the work_orders directory
      const files = await readdir(result.workOrderDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toBe('WO-_________etc_passwd.json');
    });

    it('should map priority labels to correct numeric scores', async () => {
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await mkdir(issueDir, { recursive: true });

      const issueList: LocalIssueListFile = {
        schemaVersion: '1.0.0',
        projectId: 'test-project',
        generatedAt: new Date().toISOString(),
        issues: [
          {
            id: 'ISS-001',
            number: 1,
            url: 'local://issues/ISS-001',
            title: '[Feature] Critical',
            body: '',
            state: 'open',
            labels: { raw: [], priority: 'P0', type: 'feature', size: 'M' },
            milestone: null,
            assignees: [],
            dependencies: { blocked_by: [], blocks: [] },
            estimation: { size: 'M', hours: 6 },
          },
          {
            id: 'ISS-002',
            number: 2,
            url: 'local://issues/ISS-002',
            title: '[Feature] High',
            body: '',
            state: 'open',
            labels: { raw: [], priority: 'P1', type: 'feature', size: 'M' },
            milestone: null,
            assignees: [],
            dependencies: { blocked_by: [], blocks: [] },
            estimation: { size: 'M', hours: 6 },
          },
        ],
      };

      await writeFile(join(issueDir, 'issue_list.json'), JSON.stringify(issueList), 'utf-8');

      await ExecutionScaffoldGenerator.controller(session);

      const wo1 = JSON.parse(
        await readFile(
          join(scratchpadDir, 'progress', 'test-project', 'work_orders', 'WO-ISS-001.json'),
          'utf-8'
        )
      );
      const wo2 = JSON.parse(
        await readFile(
          join(scratchpadDir, 'progress', 'test-project', 'work_orders', 'WO-ISS-002.json'),
          'utf-8'
        )
      );

      expect(wo1.priority).toBe(100); // P0
      expect(wo2.priority).toBe(75); // P1
    });
  });

  // --------------------------------------------------------------------------
  // Worker Stage
  // --------------------------------------------------------------------------

  describe('worker', () => {
    it('should generate src/index.ts with function stubs from work orders', async () => {
      // First create work orders (simulate controller output)
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await writeTestIssueList(issueDir, 2);
      await ExecutionScaffoldGenerator.controller(session);

      // Then run worker
      const result = JSON.parse(await ExecutionScaffoldGenerator.worker(session));

      expect(result.stage).toBe('worker');
      expect(result.scaffold).toBe(true);
      expect(result.functionCount).toBe(2);
      expect(result.filesCreated).toContain(join(projectDir, 'src', 'index.ts'));
      expect(result.filesCreated).toContain(join(projectDir, 'package.json'));

      // Verify index.ts content
      const indexContent = await readFile(join(projectDir, 'src', 'index.ts'), 'utf-8');
      expect(indexContent).toContain('export function issueISS001');
      expect(indexContent).toContain('export function issueISS002');
      expect(indexContent).toContain('TODO: Implement ISS-001');
      expect(indexContent).toContain('[Feature] Feature 1');
    });

    it('should generate package.json with project name', async () => {
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await writeTestIssueList(issueDir, 1);
      await ExecutionScaffoldGenerator.controller(session);

      await ExecutionScaffoldGenerator.worker(session);

      const pkg = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf-8'));
      expect(pkg.name).toBe('test-project');
      expect(pkg.version).toBe('0.1.0');
      expect(pkg.scripts.build).toBe('tsc');
    });

    it('should handle missing work orders gracefully', async () => {
      const result = JSON.parse(await ExecutionScaffoldGenerator.worker(session));

      expect(result.functionCount).toBe(0);
      // Should still create the files (empty scaffold)
      expect(result.filesCreated).toContain(join(projectDir, 'src', 'index.ts'));
    });
  });

  // --------------------------------------------------------------------------
  // Validation Stage
  // --------------------------------------------------------------------------

  describe('validation', () => {
    it('should generate vnv-report.json with requirement counts from work orders', async () => {
      // Set up the pipeline output
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await writeTestIssueList(issueDir, 3);
      await ExecutionScaffoldGenerator.controller(session);

      const result = JSON.parse(await ExecutionScaffoldGenerator.validation(session));

      expect(result.stage).toBe('validation-agent');
      expect(result.scaffold).toBe(true);
      expect(result.overallResult).toBe('pass_with_warnings');

      // Verify the actual report file
      const report = JSON.parse(await readFile(result.reportPath, 'utf-8'));
      expect(report.projectId).toBe('test-project');
      expect(report.overallResult).toBe('pass_with_warnings');
      expect(report.summary.totalRequirements).toBe(3);
      expect(report.summary.implementedRequirements).toBe(3);
      expect(report.summary.coveragePercent).toBe(100);
      expect(report.notes).toContain('local+stub mode');
    });

    it('should handle missing work orders with default count', async () => {
      const result = JSON.parse(await ExecutionScaffoldGenerator.validation(session));

      const report = JSON.parse(await readFile(result.reportPath, 'utf-8'));
      expect(report.summary.totalRequirements).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Review Stage
  // --------------------------------------------------------------------------

  describe('review', () => {
    it('should generate review-report.md referencing work orders and V&V report', async () => {
      // Run full pipeline: controller → worker → validation → review
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await writeTestIssueList(issueDir, 2);
      await ExecutionScaffoldGenerator.controller(session);
      await ExecutionScaffoldGenerator.worker(session);
      await ExecutionScaffoldGenerator.validation(session);

      const result = JSON.parse(await ExecutionScaffoldGenerator.review(session));

      expect(result.stage).toBe('review');
      expect(result.scaffold).toBe(true);
      expect(result.workOrdersReviewed).toBe(2);

      // Verify review document content
      const reviewContent = await readFile(result.reviewPath, 'utf-8');
      expect(reviewContent).toContain('# Review Report');
      expect(reviewContent).toContain('test-project');
      expect(reviewContent).toContain('local+stub (scaffold)');
      expect(reviewContent).toContain('WO-ISS-001');
      expect(reviewContent).toContain('WO-ISS-002');
      expect(reviewContent).toContain('pass_with_warnings');
      expect(reviewContent).toContain('Coverage');
    });

    it('should handle missing prior stage outputs gracefully', async () => {
      const result = JSON.parse(await ExecutionScaffoldGenerator.review(session));

      expect(result.workOrdersReviewed).toBe(0);

      const reviewContent = await readFile(result.reviewPath, 'utf-8');
      expect(reviewContent).toContain('No work orders found');
      expect(reviewContent).toContain('No V&V report found');
    });
  });

  // --------------------------------------------------------------------------
  // Full Pipeline Integration
  // --------------------------------------------------------------------------

  describe('full pipeline flow', () => {
    it('should produce a complete scaffold from issue_list through review', async () => {
      const issueDir = join(scratchpadDir, 'issues', 'test-project');
      await writeTestIssueList(issueDir, 4);

      // Stage 1: Controller
      const controllerResult = JSON.parse(await ExecutionScaffoldGenerator.controller(session));
      expect(controllerResult.workOrderCount).toBe(4);

      // Stage 2: Worker
      const workerResult = JSON.parse(await ExecutionScaffoldGenerator.worker(session));
      expect(workerResult.functionCount).toBe(4);

      // Stage 3: Validation
      const validationResult = JSON.parse(await ExecutionScaffoldGenerator.validation(session));
      expect(validationResult.overallResult).toBe('pass_with_warnings');

      // Stage 4: Review
      const reviewResult = JSON.parse(await ExecutionScaffoldGenerator.review(session));
      expect(reviewResult.workOrdersReviewed).toBe(4);

      // Verify file structure
      const woFiles = await readdir(controllerResult.workOrderDir);
      expect(woFiles).toHaveLength(4);

      const srcFiles = await readdir(join(projectDir, 'src'));
      expect(srcFiles).toContain('index.ts');

      const reviewContent = await readFile(reviewResult.reviewPath, 'utf-8');
      expect(reviewContent).toContain('WO-ISS-004');
    });
  });
});
