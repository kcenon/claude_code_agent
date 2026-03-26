/**
 * Tests for ValidationAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logging
vi.mock('../../src/logging/index.js', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

import {
  ValidationAgent,
  resetValidationAgent,
  getValidationAgent,
  VALIDATION_AGENT_ID,
} from '../../src/validation-agent/ValidationAgent.js';
import type { ValidationContext } from '../../src/validation-agent/types.js';
import type {
  RtmEntry,
  RequirementsTraceabilityMatrix,
  RtmCoverageMetrics,
  RtmGap,
} from '../../src/rtm-builder/types.js';

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
    totalRequirements: 1,
    requirementsWithFeatures: 1,
    requirementsWithComponents: 1,
    requirementsWithIssues: 1,
    requirementsWithImplementations: 1,
    requirementsWithPRs: 1,
    forwardCoveragePercent: 100,
    backwardCoveragePercent: 100,
    acceptanceCriteriaTotal: 1,
    acceptanceCriteriaValidated: 1,
    ...overrides,
  };
}

function createMockRtm(
  entries: readonly RtmEntry[] = [createMockRtmEntry()],
  gaps: readonly RtmGap[] = [],
  metrics?: Partial<RtmCoverageMetrics>
): RequirementsTraceabilityMatrix {
  return {
    version: '1.0.0',
    projectId: 'test-project',
    generatedAt: '2026-01-01T00:00:00.000Z',
    pipelineMode: 'greenfield',
    entries,
    coverageMetrics: createMockCoverageMetrics({
      totalRequirements: entries.length,
      ...metrics,
    }),
    gaps,
  };
}

function createMockContext(
  rtm: RequirementsTraceabilityMatrix,
  overrides: Partial<ValidationContext> = {}
): ValidationContext {
  return {
    projectDir: '/project',
    projectId: 'test-project',
    pipelineMode: 'greenfield',
    rigor: 'standard',
    pipelineId: 'pipeline-001',
    rtm,
    ...overrides,
  };
}

// =============================================================================
// ValidationAgent
// =============================================================================

describe('ValidationAgent', () => {
  let agent: ValidationAgent;

  beforeEach(() => {
    resetValidationAgent();
    agent = new ValidationAgent();
  });

  describe('agent metadata', () => {
    it('should have the correct agent ID', () => {
      expect(agent.agentId).toBe(VALIDATION_AGENT_ID);
      expect(agent.agentId).toBe('validation-agent');
    });

    it('should have a human-readable name', () => {
      expect(agent.name).toBe('Validation Agent');
    });
  });

  describe('singleton', () => {
    it('should return the same instance from getValidationAgent', () => {
      const a = getValidationAgent();
      const b = getValidationAgent();
      expect(a).toBe(b);
    });

    it('should return a new instance after resetValidationAgent', () => {
      const a = getValidationAgent();
      resetValidationAgent();
      const b = getValidationAgent();
      expect(a).not.toBe(b);
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

    it('should handle double initialization', async () => {
      await agent.initialize();
      await expect(agent.initialize()).resolves.toBeUndefined();
    });
  });

  describe('validate — pass', () => {
    it('should return pass when all requirements implemented, all AC pass, no gaps', async () => {
      const entry = createMockRtmEntry();
      const rtm = createMockRtm([entry]);
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      expect(report.overallResult).toBe('pass');
      expect(report.projectId).toBe('test-project');
      expect(report.pipelineId).toBe('pipeline-001');
      expect(report.rigor).toBe('standard');
      expect(report.requirementValidation.coveragePercent).toBe(100);
      expect(report.recommendations).toHaveLength(0);
    });

    it('should have all quality gates passing when builds and tests pass', async () => {
      const entry = createMockRtmEntry();
      const rtm = createMockRtm([entry]);
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      expect(report.qualityGateResults.allGatesPassed).toBe(true);
      for (const gate of report.qualityGateResults.gateResults) {
        expect(gate.passed).toBe(true);
      }
    });
  });

  describe('validate — pass_with_warnings', () => {
    it('should return pass_with_warnings when untested AC exist', async () => {
      // Entry implemented but no implementations -> untested AC
      const entry = createMockRtmEntry({
        implementations: [],
        status: 'implemented',
      });
      // Coverage is still 100% because status is 'implemented'
      const rtm = createMockRtm([entry]);
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      // Untested AC because no implementations
      expect(report.acceptanceCriteriaValidation.untestedCriteria.length).toBeGreaterThan(0);
      // Still passes since there are no hard failures but untested AC generate warnings
      expect(report.overallResult).toBe('pass_with_warnings');
    });

    it('should return pass_with_warnings when warning-severity gaps exist', async () => {
      const entry = createMockRtmEntry();
      const rtm = createMockRtm(
        [entry],
        [
          {
            type: 'unvalidated_acceptance_criteria',
            severity: 'warning',
            affectedIds: ['FR-001', 'AC-002'],
            message: 'Some AC unvalidated',
          },
        ]
      );
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      expect(report.overallResult).toBe('pass_with_warnings');
    });

    it('should return pass_with_warnings when traceability chain is incomplete', async () => {
      const entry = createMockRtmEntry();
      const rtm = createMockRtm(
        [entry],
        [
          {
            type: 'broken_chain',
            severity: 'warning',
            affectedIds: ['CMP-005'],
            message: 'Broken chain',
          },
        ]
      );
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      // broken_chain with warning severity triggers pass_with_warnings
      expect(report.overallResult).toBe('pass_with_warnings');
    });
  });

  describe('validate — fail', () => {
    it('should return fail when critical checks fail (unimplemented requirements)', async () => {
      const entry = createMockRtmEntry({
        implementations: [],
        status: 'not_started',
      });
      const rtm = createMockRtm([entry], [], {
        requirementsWithImplementations: 0,
      });
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      // Untested AC + unimplemented requirements
      expect(report.overallResult).toBe('fail');
      expect(report.requirementValidation.unimplementedRequirements).toContain('FR-001');
    });

    it('should return fail when quality gates fail (failed tests)', async () => {
      const entry = createMockRtmEntry({
        implementations: [
          { workOrderId: 'WO-001', status: 'completed', testsPassed: false, buildPassed: true },
        ],
      });
      const rtm = createMockRtm([entry]);
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      expect(report.overallResult).toBe('fail');
      expect(report.qualityGateResults.allGatesPassed).toBe(false);
    });

    it('should return fail when error-severity gaps exist', async () => {
      const entry = createMockRtmEntry();
      const rtm = createMockRtm(
        [entry],
        [
          {
            type: 'uncovered_requirement',
            severity: 'error',
            affectedIds: ['FR-002'],
            message: 'FR-002 not covered',
          },
        ]
      );
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      expect(report.overallResult).toBe('fail');
    });

    it('should return fail when blocked implementations exist', async () => {
      const entry = createMockRtmEntry({
        implementations: [
          { workOrderId: 'WO-001', status: 'blocked', testsPassed: false, buildPassed: false },
        ],
      });
      const rtm = createMockRtm([entry]);
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      expect(report.overallResult).toBe('fail');
      expect(report.qualityGateResults.allGatesPassed).toBe(false);
    });
  });

  describe('recommendations', () => {
    it('should recommend implementing unimplemented requirements', async () => {
      const entry = createMockRtmEntry({
        implementations: [],
        status: 'not_started',
      });
      const rtm = createMockRtm([entry]);
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      expect(report.recommendations.some((r) => r.includes('Implement requirement FR-001'))).toBe(
        true
      );
    });

    it('should recommend fixing failed quality gates', async () => {
      const entry = createMockRtmEntry({
        implementations: [
          { workOrderId: 'WO-001', status: 'completed', testsPassed: false, buildPassed: false },
        ],
      });
      const rtm = createMockRtm([entry]);
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      expect(report.recommendations.some((r) => r.includes('quality gate'))).toBe(true);
    });

    it('should have a valid report structure', async () => {
      const entry = createMockRtmEntry();
      const rtm = createMockRtm([entry]);
      const context = createMockContext(rtm);

      const report = await agent.validate(context);

      // Verify the report has all expected fields
      expect(report.reportId).toBeDefined();
      expect(report.reportId).toContain('VR-');
      expect(report.generatedAt).toBeDefined();
      expect(report.requirementValidation).toBeDefined();
      expect(report.acceptanceCriteriaValidation).toBeDefined();
      expect(report.traceabilityValidation).toBeDefined();
      expect(report.qualityGateResults).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });
});
