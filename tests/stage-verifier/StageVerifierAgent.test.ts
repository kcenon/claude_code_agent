/**
 * Tests for StageVerifierAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises and node:fs before importing the module
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
import {
  StageVerifierAgent,
  STAGE_VERIFIER_AGENT_ID,
} from '../../src/stage-verifier/StageVerifierAgent.js';
import type { StageResult, StageName } from '../../src/ad-sdlc-orchestrator/types.js';
import type { VerificationContext } from '../../src/vnv/types.js';

const mockReadFile = vi.mocked(readFile);

// =============================================================================
// Test Helpers
// =============================================================================

function createMockStageResult(overrides: Partial<StageResult> = {}): StageResult {
  return {
    name: 'collection' as StageName,
    agentType: 'collector',
    status: 'completed',
    durationMs: 1000,
    output: 'Collected requirements',
    artifacts: ['.ad-sdlc/scratchpad/info/test-project/collected_info.yaml'],
    error: null,
    retryCount: 0,
    ...overrides,
  };
}

function createMockContext(overrides: Partial<VerificationContext> = {}): VerificationContext {
  return {
    projectDir: '/project',
    projectId: 'test-project',
    pipelineMode: 'greenfield',
    rigor: 'standard',
    pipelineId: 'pipeline-001',
    ...overrides,
  };
}

// =============================================================================
// StageVerifierAgent
// =============================================================================

describe('StageVerifierAgent', () => {
  let agent: StageVerifierAgent;

  beforeEach(() => {
    vi.resetAllMocks();
    agent = new StageVerifierAgent();
  });

  describe('agent metadata', () => {
    it('should have the correct agent ID', () => {
      expect(agent.agentId).toBe(STAGE_VERIFIER_AGENT_ID);
      expect(agent.agentId).toBe('stage-verifier-agent');
    });

    it('should have a human-readable name', () => {
      expect(agent.name).toBe('Stage Verifier Agent');
    });
  });

  describe('initialize and dispose', () => {
    it('should initialize without error', async () => {
      await expect(agent.initialize()).resolves.toBeUndefined();
    });

    it('should dispose without error', async () => {
      await expect(agent.dispose()).resolves.toBeUndefined();
    });
  });

  describe('verifyStage', () => {
    it('should return StageVerificationResult with correct stageName', async () => {
      const stageResult = createMockStageResult();
      const context = createMockContext();

      const result = await agent.verifyStage('collection', stageResult, context);

      expect(result.stageName).toBe('collection');
      expect(result.rigor).toBe('standard');
      expect(result.timestamp).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should pass with empty checks for a stage with no rules defined', async () => {
      const stageResult = createMockStageResult({ name: 'initialization' as StageName });
      const context = createMockContext();

      const result = await agent.verifyStage('initialization', stageResult, context);

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('No verification rules');
    });

    it('should filter rules by rigor: minimal should skip standard/strict rules', async () => {
      const stageResult = createMockStageResult();
      const context = createMockContext({ rigor: 'minimal' });

      const result = await agent.verifyStage('collection', stageResult, context);

      // With minimal rigor, only minimal-level rules should run
      // VR-COL-001 and VR-COL-002 are minimal, VR-COL-003 is standard, VR-COL-004 is strict
      const checkIds = result.checks.map((c) => c.checkId);
      expect(checkIds).toContain('VR-COL-001');
      expect(checkIds).toContain('VR-COL-002');
      expect(checkIds).not.toContain('VR-COL-003');
      expect(checkIds).not.toContain('VR-COL-004');
    });

    it('should pass when all checks pass', async () => {
      const stageResult = createMockStageResult({
        name: 'collection' as StageName,
        artifacts: ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      });
      const context = createMockContext({ rigor: 'minimal' });

      // Mock readFile to return valid YAML for VR-COL-002
      mockReadFile.mockResolvedValue(
        'project_name: test\nrequirements:\n  functional:\n    - id: FR-001'
      );

      const result = await agent.verifyStage('collection', stageResult, context);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when any error-severity check fails', async () => {
      // No collected_info artifact -> VR-COL-001 error fail
      const stageResult = createMockStageResult({
        name: 'collection' as StageName,
        artifacts: ['some_other_file.txt'],
      });
      const context = createMockContext({ rigor: 'minimal' });

      const result = await agent.verifyStage('collection', stageResult, context);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('VR-COL-001');
    });

    it('should still pass when only warning-severity checks fail', async () => {
      // PRD content with required sections but no FR-XXX identifiers
      const prdContent = [
        '# PRD',
        '## Introduction',
        'Intro text',
        '## Functional Requirements',
        'No IDs here',
        '## Non-Functional Requirements',
        'Performance etc.',
      ].join('\n');
      mockReadFile.mockResolvedValue(prdContent);

      const stageResult = createMockStageResult({
        name: 'prd_generation' as StageName,
        artifacts: ['docs/PRD.md'],
      });
      const context = createMockContext({ rigor: 'standard' });

      const result = await agent.verifyStage('prd_generation', stageResult, context);

      // VR-PRD-001 passes (artifact exists), VR-PRD-002 passes (sections present)
      // VR-PRD-003 fails (warning severity -- no FR IDs)
      // Since VR-PRD-003 is warning severity, overall should still pass
      const prd003 = result.checks.find((c) => c.checkId === 'VR-PRD-003');
      expect(prd003?.passed).toBe(false);
      expect(prd003?.severity).toBe('warning');
      expect(result.passed).toBe(true);
    });

    it('should include all standard+minimal rules at standard rigor', async () => {
      mockReadFile.mockResolvedValue(
        'project_name: test\nrequirements:\n  functional:\n    - id: FR-001'
      );

      const stageResult = createMockStageResult();
      const context = createMockContext({ rigor: 'standard' });

      const result = await agent.verifyStage('collection', stageResult, context);

      const checkIds = result.checks.map((c) => c.checkId);
      // Should include minimal rules (VR-COL-001, VR-COL-002) and standard rule (VR-COL-003)
      expect(checkIds).toContain('VR-COL-001');
      expect(checkIds).toContain('VR-COL-002');
      expect(checkIds).toContain('VR-COL-003');
      // But not strict-only (VR-COL-004)
      expect(checkIds).not.toContain('VR-COL-004');
    });

    it('should have a valid ISO timestamp', async () => {
      const stageResult = createMockStageResult();
      const context = createMockContext();

      const result = await agent.verifyStage('collection', stageResult, context);

      // Verify the timestamp is a valid ISO string
      const parsed = Date.parse(result.timestamp);
      expect(isNaN(parsed)).toBe(false);
    });
  });
});
