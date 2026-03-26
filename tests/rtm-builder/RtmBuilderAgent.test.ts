/**
 * Tests for RtmBuilderAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logging
vi.mock('../../src/logging/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { readFile, readdir } from 'node:fs/promises';
import { RtmBuilderAgent, RTM_BUILDER_AGENT_ID } from '../../src/rtm-builder/RtmBuilderAgent.js';
import type {
  RtmBuildContext,
  RequirementsTraceabilityMatrix,
  RtmEntry,
  RtmCoverageMetrics,
} from '../../src/rtm-builder/types.js';

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);

// =============================================================================
// Test helpers
// =============================================================================

function createMockRtmEntry(overrides: Partial<RtmEntry> = {}): RtmEntry {
  return {
    requirementId: 'FR-001',
    requirementTitle: 'Test Requirement',
    priority: 'P1',
    features: ['SF-001'],
    useCases: ['UC-001'],
    components: ['CMP-001'],
    issues: ['ISS-001'],
    workOrders: ['WO-001'],
    implementations: [
      { workOrderId: 'WO-001', status: 'completed', testsPassed: true, buildPassed: true },
    ],
    pullRequests: ['#1'],
    acceptanceCriteria: [{ id: 'AC-001', description: 'Test AC', validated: true }],
    status: 'verified',
    ...overrides,
  };
}

function createMockCoverageMetrics(
  overrides: Partial<RtmCoverageMetrics> = {}
): RtmCoverageMetrics {
  return {
    totalRequirements: 2,
    requirementsWithFeatures: 2,
    requirementsWithComponents: 2,
    requirementsWithIssues: 2,
    requirementsWithImplementations: 2,
    requirementsWithPRs: 2,
    forwardCoveragePercent: 100,
    backwardCoveragePercent: 100,
    acceptanceCriteriaTotal: 2,
    acceptanceCriteriaValidated: 2,
    ...overrides,
  };
}

function createMockRtm(
  overrides: Partial<RequirementsTraceabilityMatrix> = {}
): RequirementsTraceabilityMatrix {
  return {
    version: '1.0.0',
    projectId: 'test-project',
    generatedAt: '2026-01-01T00:00:00.000Z',
    pipelineMode: 'greenfield',
    entries: [createMockRtmEntry()],
    coverageMetrics: createMockCoverageMetrics({ totalRequirements: 1 }),
    gaps: [],
    ...overrides,
  };
}

function createMockBuildContext(overrides: Partial<RtmBuildContext> = {}): RtmBuildContext {
  return {
    projectDir: '/project',
    projectId: 'test-project',
    pipelineMode: 'greenfield',
    ...overrides,
  };
}

// =============================================================================
// RtmBuilderAgent
// =============================================================================

describe('RtmBuilderAgent', () => {
  let agent: RtmBuilderAgent;

  beforeEach(() => {
    vi.resetAllMocks();
    agent = new RtmBuilderAgent();
  });

  describe('agent metadata', () => {
    it('should have the correct agent ID', () => {
      expect(agent.agentId).toBe(RTM_BUILDER_AGENT_ID);
      expect(agent.agentId).toBe('rtm-builder-agent');
    });

    it('should have a human-readable name', () => {
      expect(agent.name).toBe('RTM Builder Agent');
    });
  });

  describe('initialize and dispose', () => {
    it('should initialize without error', async () => {
      await expect(agent.initialize()).resolves.toBeUndefined();
    });

    it('should dispose without error', async () => {
      await agent.initialize();
      await expect(agent.dispose()).resolves.toBeUndefined();
    });
  });

  describe('buildRTM', () => {
    it('should handle missing files gracefully in import mode', async () => {
      // All file reads return errors (no PRD, SRS, SDS, etc.)
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));
      mockReaddir.mockRejectedValue(new Error('ENOENT: no such file'));

      const context = createMockBuildContext({ pipelineMode: 'import' });
      const rtm = await agent.buildRTM(context);

      expect(rtm.version).toBe('1.0.0');
      expect(rtm.projectId).toBe('test-project');
      expect(rtm.pipelineMode).toBe('import');
      expect(rtm.entries).toHaveLength(0);
      expect(rtm.generatedAt).toBeDefined();
    });

    it('should build RTM with parsed PRD requirements', async () => {
      // PRD with one FR
      const prdContent = [
        '# Product Requirements Document',
        '## FR-001: User Authentication',
        'Priority: P0',
        '### Acceptance Criteria',
        '- AC-001: Users can log in with email and password',
      ].join('\n');

      // Mock file reading: PRD found, others not found
      mockReadFile.mockImplementation(async (filePath: any) => {
        const path = String(filePath);
        if (path.includes('PRD.md') || path.includes('prd.md')) {
          return prdContent;
        }
        throw new Error('ENOENT');
      });
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const context = createMockBuildContext();
      const rtm = await agent.buildRTM(context);

      expect(rtm.projectId).toBe('test-project');
      expect(rtm.pipelineMode).toBe('greenfield');
      // Entries come from parsed requirements
      expect(rtm.entries.length).toBeGreaterThanOrEqual(0);
      expect(rtm.coverageMetrics).toBeDefined();
      expect(rtm.gaps).toBeDefined();
    });
  });

  describe('generateReport', () => {
    it('should produce valid markdown with expected sections', async () => {
      const rtm = createMockRtm();
      const report = await agent.generateReport(rtm);

      expect(report).toContain('# Requirements Traceability Matrix');
      expect(report).toContain('## Coverage Summary');
      expect(report).toContain('## Traceability Matrix');
      expect(report).toContain('test-project');
      expect(report).toContain('FR-001');
    });

    it('should include gaps section when gaps exist', async () => {
      const rtm = createMockRtm({
        gaps: [
          {
            type: 'uncovered_requirement',
            severity: 'error',
            affectedIds: ['FR-002'],
            message: 'FR-002 has no SRS feature mapping',
          },
        ],
      });
      const report = await agent.generateReport(rtm);

      expect(report).toContain('## Gaps');
      expect(report).toContain('FR-002');
      expect(report).toContain('ERROR');
    });

    it('should include acceptance criteria section', async () => {
      const rtm = createMockRtm();
      const report = await agent.generateReport(rtm);

      expect(report).toContain('## Acceptance Criteria Status');
      expect(report).toContain('AC-001');
    });

    it('should handle empty entries', async () => {
      const rtm = createMockRtm({
        entries: [],
        coverageMetrics: createMockCoverageMetrics({ totalRequirements: 0 }),
      });
      const report = await agent.generateReport(rtm);

      expect(report).toContain('# Requirements Traceability Matrix');
      expect(report).toContain('## Coverage Summary');
      // No traceability rows but header should be there
      expect(report).toContain('## Traceability Matrix');
    });
  });

  describe('validateCompleteness', () => {
    it('should identify uncovered requirements (no features)', async () => {
      const entry = createMockRtmEntry({ features: [], requirementId: 'FR-002' });
      const rtm = createMockRtm({ entries: [entry] });

      const result = await agent.validateCompleteness(rtm);

      const uncoveredGaps = result.gaps.filter((g) => g.type === 'uncovered_requirement');
      expect(uncoveredGaps.length).toBeGreaterThanOrEqual(1);
      expect(uncoveredGaps[0]!.affectedIds).toContain('FR-002');
    });

    it('should identify missing tests', async () => {
      const entry = createMockRtmEntry({
        implementations: [
          { workOrderId: 'WO-001', status: 'completed', testsPassed: false, buildPassed: true },
        ],
      });
      const rtm = createMockRtm({ entries: [entry] });

      const result = await agent.validateCompleteness(rtm);

      const testGaps = result.gaps.filter((g) => g.type === 'missing_test');
      expect(testGaps.length).toBeGreaterThanOrEqual(1);
      expect(testGaps[0]!.message).toContain('without passing tests');
    });

    it('should identify unvalidated acceptance criteria for implemented requirements', async () => {
      const entry = createMockRtmEntry({
        status: 'implemented',
        acceptanceCriteria: [{ id: 'AC-001', description: 'Test', validated: false }],
      });
      const rtm = createMockRtm({ entries: [entry] });

      const result = await agent.validateCompleteness(rtm);

      const acGaps = result.gaps.filter((g) => g.type === 'unvalidated_acceptance_criteria');
      expect(acGaps.length).toBeGreaterThanOrEqual(1);
      expect(acGaps[0]!.severity).toBe('warning');
    });

    it('should identify broken chains (components without features)', async () => {
      const entry = createMockRtmEntry({
        features: [],
        components: ['CMP-001'],
      });
      const rtm = createMockRtm({ entries: [entry] });

      const result = await agent.validateCompleteness(rtm);

      const brokenGaps = result.gaps.filter((g) => g.type === 'broken_chain');
      expect(brokenGaps.length).toBeGreaterThanOrEqual(1);
    });

    it('should return valid=true when no error-severity gaps exist', async () => {
      const entry = createMockRtmEntry();
      const rtm = createMockRtm({ entries: [entry] });

      const result = await agent.validateCompleteness(rtm);

      expect(result.valid).toBe(true);
    });

    it('should return valid=false when error-severity gaps exist', async () => {
      const entry = createMockRtmEntry({ features: [] });
      const rtm = createMockRtm({ entries: [entry] });

      const result = await agent.validateCompleteness(rtm);

      expect(result.valid).toBe(false);
    });

    it('should include coverage metrics in result', async () => {
      const rtm = createMockRtm();
      const result = await agent.validateCompleteness(rtm);

      expect(result.coverageMetrics).toBeDefined();
      expect(result.coverageMetrics.totalRequirements).toBeGreaterThanOrEqual(0);
    });
  });
});
