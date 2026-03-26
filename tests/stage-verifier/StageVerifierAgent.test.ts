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
import { existsSync } from 'node:fs';
import {
  StageVerifierAgent,
  STAGE_VERIFIER_AGENT_ID,
} from '../../src/stage-verifier/StageVerifierAgent.js';
import { StageVerificationError } from '../../src/stage-verifier/errors.js';
import type { StageResult, StageName } from '../../src/ad-sdlc-orchestrator/types.js';
import type { VerificationContext } from '../../src/vnv/types.js';

const mockExistsSync = vi.mocked(existsSync);

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

    it('should verify prd_generation stage with valid PRD', async () => {
      const prdContent = [
        '# PRD',
        '## Introduction',
        'Intro text',
        '## Functional Requirements',
        '### FR-001: Login',
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

      expect(result.stageName).toBe('prd_generation');
      expect(result.passed).toBe(true);
      const checkIds = result.checks.map((c) => c.checkId);
      expect(checkIds).toContain('VR-PRD-001');
      expect(checkIds).toContain('VR-PRD-002');
      expect(checkIds).toContain('VR-PRD-003');
    });

    it('should verify srs_generation stage with valid SRS', async () => {
      const srsContent = [
        '# SRS',
        '## Introduction',
        'Intro text',
        '## Software Features',
        '### SF-001: Login',
      ].join('\n');
      mockReadFile.mockResolvedValue(srsContent);

      const stageResult = createMockStageResult({
        name: 'srs_generation' as StageName,
        artifacts: ['docs/SRS.md'],
      });
      const context = createMockContext({ rigor: 'standard' });

      const result = await agent.verifyStage('srs_generation', stageResult, context);

      expect(result.stageName).toBe('srs_generation');
      expect(result.passed).toBe(true);
    });

    it('should verify sds_generation stage with valid SDS', async () => {
      const sdsContent = [
        '# SDS',
        '## Introduction',
        'Intro text',
        '## System Architecture',
        'Architecture overview',
        '## Component Design',
        '### CMP-001: Auth',
      ].join('\n');
      mockReadFile.mockResolvedValue(sdsContent);

      const stageResult = createMockStageResult({
        name: 'sds_generation' as StageName,
        artifacts: ['docs/SDS.md'],
      });
      const context = createMockContext({ rigor: 'standard' });

      const result = await agent.verifyStage('sds_generation', stageResult, context);

      expect(result.stageName).toBe('sds_generation');
      expect(result.passed).toBe(true);
    });

    it('should verify issue_generation stage with valid issue list', async () => {
      mockReadFile.mockResolvedValue('[{"id": 1, "title": "Bug fix"}]');

      const stageResult = createMockStageResult({
        name: 'issue_generation' as StageName,
        artifacts: ['output/issues.json'],
      });
      const context = createMockContext({ rigor: 'standard' });

      const result = await agent.verifyStage('issue_generation', stageResult, context);

      expect(result.stageName).toBe('issue_generation');
      expect(result.passed).toBe(true);
    });

    it('should verify review stage with valid review result', async () => {
      mockReadFile.mockResolvedValue('decision: approve\ncomments: []');

      const stageResult = createMockStageResult({
        name: 'review' as StageName,
        artifacts: ['output/review_result.yaml'],
      });
      const context = createMockContext({ rigor: 'standard' });

      const result = await agent.verifyStage('review', stageResult, context);

      expect(result.stageName).toBe('review');
      expect(result.passed).toBe(true);
    });

    it('should handle rule execution errors gracefully', async () => {
      // Force readFile to throw an unexpected error
      mockReadFile.mockImplementation(() => {
        throw new Error('Unexpected internal error');
      });

      const stageResult = createMockStageResult({
        name: 'collection' as StageName,
        artifacts: ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      });
      const context = createMockContext({ rigor: 'minimal' });

      const result = await agent.verifyStage('collection', stageResult, context);

      // VR-COL-001 passes (artifact check only), VR-COL-002 may error
      // The agent should not throw, but record the error as a failed check
      expect(result.timestamp).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include strict rules at strict rigor', async () => {
      const yamlContent =
        'requirements:\n  functional:\n    - id: FR-001\n      acceptanceCriteria:\n        - AC-001';
      mockReadFile.mockResolvedValue(yamlContent);

      const stageResult = createMockStageResult({
        artifacts: ['.ad-sdlc/scratchpad/info/test/collected_info.yaml'],
      });
      const context = createMockContext({ rigor: 'strict' });

      const result = await agent.verifyStage('collection', stageResult, context);

      const checkIds = result.checks.map((c) => c.checkId);
      expect(checkIds).toContain('VR-COL-001');
      expect(checkIds).toContain('VR-COL-002');
      expect(checkIds).toContain('VR-COL-003');
      expect(checkIds).toContain('VR-COL-004');
    });
  });

  describe('verifyCrossDocumentConsistency', () => {
    it('should return passed=true when sync points file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(0);
      expect(result.violations).toHaveLength(0);
    });

    it('should throw StageVerificationError when sync points file cannot be read', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      await expect(agent.verifyCrossDocumentConsistency('/project', 'prd')).rejects.toThrow(
        StageVerificationError
      );
    });

    it('should throw StageVerificationError when sync points is not valid YAML', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('{ invalid yaml: [');

      await expect(agent.verifyCrossDocumentConsistency('/project', 'prd')).rejects.toThrow(
        StageVerificationError
      );
    });

    it('should throw StageVerificationError when parsed YAML is not an object', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('just a string');

      await expect(agent.verifyCrossDocumentConsistency('/project', 'prd')).rejects.toThrow(
        StageVerificationError
      );
    });

    it('should return passed=true when no syncPoints array exists', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('otherKey: value');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(0);
    });

    it('should detect violations when pattern is found in some but not all docs', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - name: project-name',
        '    documents: [prd, srs]',
        '    pattern: MyProject',
        '    severity: high',
      ].join('\n');

      // existsSync: sync file, then prd doc, then srs doc, then sds doc
      mockExistsSync
        .mockReturnValueOnce(true) // sync-points file
        .mockReturnValueOnce(true) // prd doc
        .mockReturnValueOnce(true) // srs doc
        .mockReturnValueOnce(false); // sds doc

      mockReadFile
        .mockResolvedValueOnce(syncYaml) // sync-points
        .mockResolvedValueOnce('# PRD\nProject: MyProject') // prd
        .mockResolvedValueOnce('# SRS\nProject: OtherName'); // srs

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(false);
      expect(result.syncPointsChecked).toBe(1);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].syncPointName).toBe('project-name');
      expect(result.violations[0].severity).toBe('high');
    });

    it('should pass when pattern is found in all referenced docs', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - name: project-name',
        '    documents: [prd, srs]',
        '    pattern: MyProject',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true) // sync-points file
        .mockReturnValueOnce(true) // prd doc
        .mockReturnValueOnce(true) // srs doc
        .mockReturnValueOnce(false); // sds doc

      mockReadFile
        .mockResolvedValueOnce(syncYaml) // sync-points
        .mockResolvedValueOnce('# PRD\nProject: MyProject') // prd
        .mockResolvedValueOnce('# SRS\nProject: MyProject'); // srs

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(1);
      expect(result.violations).toHaveLength(0);
    });

    it('should skip sync points with fewer than 2 documents', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - name: single-doc',
        '    documents: [prd]',
        '    pattern: MyProject',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true) // sync-points file
        .mockReturnValueOnce(true) // prd
        .mockReturnValueOnce(false) // srs
        .mockReturnValueOnce(false); // sds

      mockReadFile.mockResolvedValueOnce(syncYaml).mockResolvedValueOnce('# PRD\nMyProject');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(0);
    });

    it('should skip sync points without a pattern/value', async () => {
      const syncYaml = ['syncPoints:', '  - name: no-pattern', '    documents: [prd, srs]'].join(
        '\n'
      );

      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mockReadFile
        .mockResolvedValueOnce(syncYaml)
        .mockResolvedValueOnce('# PRD')
        .mockResolvedValueOnce('# SRS');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(1);
      expect(result.violations).toHaveLength(0);
    });

    it('should skip non-object sync point entries', async () => {
      const syncYaml = 'syncPoints:\n  - not an object\n  - 42';

      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);

      mockReadFile.mockResolvedValueOnce(syncYaml);

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(0);
    });

    it('should use default severity=medium when none specified', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - name: no-severity-sync',
        '    documents: [prd, srs]',
        '    pattern: SharedValue',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true) // sync-points
        .mockReturnValueOnce(true) // prd
        .mockReturnValueOnce(true) // srs
        .mockReturnValueOnce(false); // sds

      mockReadFile
        .mockResolvedValueOnce(syncYaml)
        .mockResolvedValueOnce('# PRD\nSharedValue here')
        .mockResolvedValueOnce('# SRS\nNo shared value');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(false);
      expect(result.violations[0].severity).toBe('medium');
    });

    it('should handle sync_points key (snake_case)', async () => {
      const syncYaml = [
        'sync_points:',
        '  - name: test-point',
        '    documents: [prd, srs]',
        '    pattern: TestValue',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mockReadFile
        .mockResolvedValueOnce(syncYaml)
        .mockResolvedValueOnce('# PRD\nTestValue')
        .mockResolvedValueOnce('# SRS\nTestValue');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(1);
    });

    it('should handle sync point using value instead of pattern', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - name: val-point',
        '    documents: [prd, srs]',
        '    value: SpecificValue',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mockReadFile
        .mockResolvedValueOnce(syncYaml)
        .mockResolvedValueOnce('# PRD\nSpecificValue')
        .mockResolvedValueOnce('# SRS\nSpecificValue');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(1);
    });

    it('should handle sync point with id instead of name', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - id: numeric-id',
        '    documents: [prd, srs]',
        '    pattern: TestVal',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mockReadFile
        .mockResolvedValueOnce(syncYaml)
        .mockResolvedValueOnce('# PRD\nTestVal')
        .mockResolvedValueOnce('# SRS\nOther');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.violations[0].syncPointName).toBe('numeric-id');
    });

    it('should use "unknown" when sync point has no name or id', async () => {
      const syncYaml = ['syncPoints:', '  - documents: [prd, srs]', '    pattern: Val'].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mockReadFile
        .mockResolvedValueOnce(syncYaml)
        .mockResolvedValueOnce('# PRD\nVal')
        .mockResolvedValueOnce('# SRS\nOther');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.violations[0].syncPointName).toBe('unknown');
    });

    it('should skip documents that cannot be read', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - name: test',
        '    documents: [prd, srs]',
        '    pattern: Val',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true) // sync file
        .mockReturnValueOnce(true) // prd exists
        .mockReturnValueOnce(true) // srs exists
        .mockReturnValueOnce(false); // sds

      mockReadFile
        .mockResolvedValueOnce(syncYaml) // sync file
        .mockResolvedValueOnce('# PRD\nVal') // prd
        .mockRejectedValueOnce(new Error('EACCES')); // srs read fails

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      // SRS is skipped (unreadable), so only prd has the pattern -> no violation because
      // docsWithoutPattern has no entry for srs (it was skipped entirely)
      expect(result.passed).toBe(true);
    });

    it('should handle sync point with numeric name', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - name: 123',
        '    documents: [prd, srs]',
        '    pattern: Test',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mockReadFile
        .mockResolvedValueOnce(syncYaml)
        .mockResolvedValueOnce('# PRD\nTest')
        .mockResolvedValueOnce('# SRS\nOther');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.violations[0].syncPointName).toBe('123');
    });

    it('should handle docs key (alt for documents)', async () => {
      const syncYaml = [
        'syncPoints:',
        '  - name: alt-key',
        '    docs: [prd, srs]',
        '    pattern: TestPattern',
      ].join('\n');

      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mockReadFile
        .mockResolvedValueOnce(syncYaml)
        .mockResolvedValueOnce('# PRD\nTestPattern')
        .mockResolvedValueOnce('# SRS\nTestPattern');

      const result = await agent.verifyCrossDocumentConsistency('/project', 'prd');

      expect(result.passed).toBe(true);
      expect(result.syncPointsChecked).toBe(1);
    });
  });
});
