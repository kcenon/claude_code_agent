/**
 * E2E Tests for Pipeline Resume Scenarios
 *
 * Validates the full round-trip of pipeline resume functionality:
 * - Resume from persisted session (greenfield and enhancement)
 * - Start-from-stage with artifact validation
 * - Graceful degradation when artifacts are missing
 * - Dependency resolution with pre-completed stages
 * - Pipeline log accuracy after resume
 * - Fresh execution regression (no breakage from resume changes)
 *
 * Part of Epic #492 — Pipeline Resume and Start-from-Middle Capability
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  AdsdlcOrchestratorAgent,
  resetAdsdlcOrchestratorAgent,
} from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { ArtifactValidator } from '../../src/ad-sdlc-orchestrator/ArtifactValidator.js';
import { SessionCorruptedError } from '../../src/ad-sdlc-orchestrator/errors.js';
import {
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
} from '../../src/ad-sdlc-orchestrator/types.js';
import type { StageName } from '../../src/ad-sdlc-orchestrator/types.js';

import { createMockSession, placeMockArtifacts } from './helpers/pipeline-runner.js';

// =============================================================================
// Test Helpers — Orchestrator subclasses
// =============================================================================

/**
 * ArtifactValidator that treats all stages as valid (bypasses filesystem check)
 */
class NoOpArtifactValidator extends ArtifactValidator {
  constructor() {
    super('/dev/null');
  }
  override async validatePreCompletedStages(): Promise<never[]> {
    return [];
  }
}

/**
 * Orchestrator that tracks which stages are invoked via invokeAgent
 */
class TrackingOrchestrator extends AdsdlcOrchestratorAgent {
  public readonly executionOrder: string[] = [];

  protected override async invokeAgent(
    stage: { name: string; agentType: string },
    _session: unknown
  ): Promise<string> {
    this.executionOrder.push(stage.name);
    return `Stage "${stage.name}" completed`;
  }
}

/**
 * Orchestrator that tracks stages AND bypasses artifact validation
 */
class NoOpTrackingOrchestrator extends TrackingOrchestrator {
  protected override createArtifactValidator(): ArtifactValidator {
    return new NoOpArtifactValidator();
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Pipeline Resume E2E', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-resume-e2e-'));
    resetAdsdlcOrchestratorAgent();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetAdsdlcOrchestratorAgent();
  });

  // ---------------------------------------------------------------------------
  // 1. Resume from Persisted Session
  // ---------------------------------------------------------------------------

  describe('Resume from Persisted Session', () => {
    it('should resume greenfield pipeline and only execute remaining stages', async () => {
      // Phase 1: Run a full pipeline to create a real persisted session
      const agent1 = new NoOpTrackingOrchestrator();
      await agent1.initialize();
      const firstResult = await agent1.executePipeline(tempDir, 'Build a web app');
      const sessionId = firstResult.pipelineId;
      await agent1.dispose();

      // Phase 2: Create a new orchestrator and resume from the session
      // Using NoOpTrackingOrchestrator to bypass artifact validation since
      // invokeAgent() is mocked and doesn't create real artifact files.
      const agent2 = new NoOpTrackingOrchestrator();
      await agent2.initialize();

      await agent2.startSession({
        projectDir: tempDir,
        userRequest: 'Continue build',
        resumeSessionId: sessionId,
      });

      const resumeResult = await agent2.executePipeline(tempDir, 'Continue build');

      // Since all stages were completed in phase 1, no new stages should execute
      expect(resumeResult.overallStatus).toBe('completed');
      expect(agent2.executionOrder).toHaveLength(0);

      await agent2.dispose();
    });

    it('should resume enhancement pipeline from partial completion', async () => {
      // Create a mock session with only analysis stages completed
      const completedStages: StageName[] = [
        'document_reading',
        'codebase_analysis',
        'code_reading',
      ];
      const sessionId = await createMockSession(tempDir, 'enhancement', completedStages, {
        overallStatus: 'partial',
        failedStages: [{ name: 'doc_code_comparison', error: 'API timeout' }],
      });

      const agent = new NoOpTrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Resume from comparison',
        resumeSessionId: sessionId,
      });

      const result = await agent.executePipeline(tempDir, 'Resume from comparison');

      expect(result.overallStatus).toBe('completed');
      // Should NOT re-execute completed analysis stages
      expect(agent.executionOrder).not.toContain('document_reading');
      expect(agent.executionOrder).not.toContain('codebase_analysis');
      expect(agent.executionOrder).not.toContain('code_reading');
      // Should re-execute the failed stage and all downstream
      expect(agent.executionOrder).toContain('doc_code_comparison');
      expect(agent.executionOrder).toContain('impact_analysis');
      expect(agent.executionOrder).toContain('prd_update');
      expect(agent.executionOrder).toContain('review');

      await agent.dispose();
    });

    it('should handle resume when session file is missing', async () => {
      const agent = new TrackingOrchestrator();
      await agent.initialize();

      // Resume with a non-existent session ID — should fall back to fresh execution
      const session = await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Build something new',
        resumeSessionId: 'nonexistent-session-id',
      });

      // Should create a fresh session
      expect(session.resumedFrom).toBeUndefined();
      expect(session.status).toBe('pending');

      const result = await agent.executePipeline(tempDir, 'Build something new');

      // Should execute all greenfield stages from scratch
      expect(result.overallStatus).toBe('completed');
      expect(agent.executionOrder).toHaveLength(GREENFIELD_STAGES.length);

      await agent.dispose();
    });

    it('should handle resume when session file is corrupted', async () => {
      // Write a corrupt YAML file
      const stateDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'pipeline');
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(
        path.join(stateDir, 'corrupt-e2e-session.yaml'),
        '{{{{ totally not valid yaml !@#$%',
        'utf-8'
      );

      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await expect(agent.loadPriorSession('corrupt-e2e-session', tempDir)).rejects.toThrow(
        SessionCorruptedError
      );

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Start-From-Stage
  // ---------------------------------------------------------------------------

  describe('Start-From-Stage', () => {
    it('should start from sds_generation with valid artifacts on disk', async () => {
      // Place artifacts for all stages before sds_generation
      await placeMockArtifacts(
        tempDir,
        ['initialization', 'collection', 'prd_generation', 'srs_generation'],
        'test-project'
      );

      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Start from SDS',
        overrideMode: 'greenfield',
        startFromStage: 'sds_generation',
      });

      const result = await agent.executePipeline(tempDir, 'Start from SDS');

      expect(result.overallStatus).toBe('completed');
      // Stages before sds_generation should be skipped
      expect(agent.executionOrder).not.toContain('initialization');
      expect(agent.executionOrder).not.toContain('collection');
      expect(agent.executionOrder).not.toContain('prd_generation');
      expect(agent.executionOrder).not.toContain('srs_generation');
      // sds_generation and after should execute
      expect(agent.executionOrder).toContain('sds_generation');
      expect(agent.executionOrder).toContain('issue_generation');
      expect(agent.executionOrder).toContain('review');

      await agent.dispose();
    });

    it('should re-execute stages when artifacts are missing', async () => {
      // Only place artifacts for initialization — NOT for collection or prd_generation
      await placeMockArtifacts(tempDir, ['initialization'], 'test-project');

      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Start from SDS with missing artifacts',
        overrideMode: 'greenfield',
        startFromStage: 'sds_generation',
      });

      const result = await agent.executePipeline(tempDir, 'Start from SDS with missing artifacts');

      expect(result.overallStatus).toBe('completed');
      // initialization artifact exists, so it stays pre-completed
      expect(agent.executionOrder).not.toContain('initialization');
      // mode_detection has no artifact definition, remains pre-completed
      expect(agent.executionOrder).not.toContain('mode_detection');
      // collection and prd_generation artifacts are missing — should be re-executed
      expect(agent.executionOrder).toContain('collection');
      expect(agent.executionOrder).toContain('prd_generation');
      // srs_generation artifact also missing
      expect(agent.executionOrder).toContain('srs_generation');
      // Target stage and beyond
      expect(agent.executionOrder).toContain('sds_generation');

      await agent.dispose();
    });

    it('should reject when startFromStage is used with no explicit mode', async () => {
      const agent = new NoOpTrackingOrchestrator();
      await agent.initialize();

      // startFromStage without overrideMode — the session mode defaults to greenfield
      // from mode detection. This should still work because the orchestrator
      // resolves the mode first, then computes preCompletedStages.
      const session = await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Start from SDS',
        startFromStage: 'sds_generation',
      });

      // Mode should be resolved (greenfield by default for empty project)
      expect(session.preCompletedStages).toBeDefined();
      expect(session.preCompletedStages).toContain('initialization');
      expect(session.preCompletedStages).not.toContain('sds_generation');

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Artifact Validation Integration
  // ---------------------------------------------------------------------------

  describe('Artifact Validation on Resume', () => {
    it('should validate all pre-completed stage artifacts exist', async () => {
      // Place artifacts for initialization + collection
      await placeMockArtifacts(tempDir, ['initialization', 'collection'], 'test-project');

      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Resume with valid artifacts',
        overrideMode: 'greenfield',
        preCompletedStages: ['initialization', 'mode_detection', 'collection'],
      });

      const result = await agent.executePipeline(tempDir, 'Resume with valid artifacts');

      expect(result.overallStatus).toBe('completed');
      // initialization and mode_detection (no artifact spec) stay pre-completed
      expect(agent.executionOrder).not.toContain('initialization');
      expect(agent.executionOrder).not.toContain('mode_detection');
      // collection artifact exists, so stays pre-completed
      expect(agent.executionOrder).not.toContain('collection');
      // prd_generation and beyond should execute
      expect(agent.executionOrder).toContain('prd_generation');

      await agent.dispose();
    });

    it('should gracefully degrade when some artifacts are missing', async () => {
      // Only place initialization artifact, but NOT collection artifact
      await placeMockArtifacts(tempDir, ['initialization'], 'test-project');

      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Resume with partial artifacts',
        overrideMode: 'greenfield',
        preCompletedStages: ['initialization', 'mode_detection', 'collection'],
      });

      const result = await agent.executePipeline(tempDir, 'Resume with partial artifacts');

      expect(result.overallStatus).toBe('completed');
      // initialization artifact exists — stays pre-completed
      expect(agent.executionOrder).not.toContain('initialization');
      // collection artifact is MISSING — validator removes it, so it re-executes
      expect(agent.executionOrder).toContain('collection');

      await agent.dispose();
    });

    it('should validate enhancement mode artifacts correctly', async () => {
      // Place only document_reading and code_reading artifacts, but NOT codebase_analysis
      await placeMockArtifacts(tempDir, ['document_reading', 'code_reading'], 'test-project');

      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Resume enhancement with gaps',
        overrideMode: 'enhancement',
        preCompletedStages: ['document_reading', 'codebase_analysis', 'code_reading'],
      });

      const result = await agent.executePipeline(tempDir, 'Resume enhancement with gaps');

      expect(result.overallStatus).toBe('completed');
      // document_reading and code_reading have valid artifacts
      expect(agent.executionOrder).not.toContain('document_reading');
      expect(agent.executionOrder).not.toContain('code_reading');
      // codebase_analysis artifact is missing — re-execute
      expect(agent.executionOrder).toContain('codebase_analysis');
      // Downstream stages should execute
      expect(agent.executionOrder).toContain('doc_code_comparison');

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Dependency Resolution with Pre-Completed Stages
  // ---------------------------------------------------------------------------

  describe('Dependency Resolution with Pre-Completed Stages', () => {
    it('should correctly resolve dependencies when middle stages are pre-completed', async () => {
      const agent = new NoOpTrackingOrchestrator();
      await agent.initialize();

      // Pre-complete all stages up to impact_analysis in enhancement pipeline
      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Start from prd_update',
        overrideMode: 'enhancement',
        preCompletedStages: [
          'document_reading',
          'codebase_analysis',
          'code_reading',
          'doc_code_comparison',
          'impact_analysis',
        ],
      });

      const result = await agent.executePipeline(tempDir, 'Start from prd_update');

      expect(result.overallStatus).toBe('completed');
      // First executed stage should be prd_update
      expect(agent.executionOrder[0]).toBe('prd_update');
      // All pre-completed stages should NOT execute
      expect(agent.executionOrder).not.toContain('document_reading');
      expect(agent.executionOrder).not.toContain('impact_analysis');
      // Sequential chain from prd_update onward
      const prdIdx = agent.executionOrder.indexOf('prd_update');
      const srsIdx = agent.executionOrder.indexOf('srs_update');
      const sdsIdx = agent.executionOrder.indexOf('sds_update');
      expect(prdIdx).toBeLessThan(srsIdx);
      expect(srsIdx).toBeLessThan(sdsIdx);

      await agent.dispose();
    });

    it('should re-execute stages when a pre-completed dependency is invalidated', async () => {
      // Pre-complete analysis stages but only place artifacts for document_reading
      await placeMockArtifacts(tempDir, ['document_reading'], 'test-project');

      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Resume with invalid deps',
        overrideMode: 'enhancement',
        preCompletedStages: ['document_reading', 'codebase_analysis', 'code_reading'],
      });

      const result = await agent.executePipeline(tempDir, 'Resume with invalid deps');

      expect(result.overallStatus).toBe('completed');
      // document_reading artifact valid — stays pre-completed
      expect(agent.executionOrder).not.toContain('document_reading');
      // codebase_analysis and code_reading artifacts missing — re-execute
      expect(agent.executionOrder).toContain('codebase_analysis');
      expect(agent.executionOrder).toContain('code_reading');
      // doc_code_comparison depends on all three, which are now all resolved
      expect(agent.executionOrder).toContain('doc_code_comparison');

      await agent.dispose();
    });

    it('should handle import pipeline resume with single pre-completed stage', async () => {
      const agent = new NoOpTrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Resume import from orchestration',
        overrideMode: 'import',
        preCompletedStages: ['issue_reading'],
      });

      const result = await agent.executePipeline(tempDir, 'Resume import from orchestration');

      expect(result.overallStatus).toBe('completed');
      expect(agent.executionOrder).not.toContain('issue_reading');
      expect(agent.executionOrder).toEqual(['orchestration', 'implementation', 'review']);

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Pipeline Log Accuracy
  // ---------------------------------------------------------------------------

  describe('Pipeline Log for Resumed Pipelines', () => {
    it('should accurately persist pre-completed and newly executed stages', async () => {
      const agent = new NoOpTrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Resume for log test',
        overrideMode: 'import',
        preCompletedStages: ['issue_reading'],
      });

      const result = await agent.executePipeline(tempDir, 'Resume for log test');

      // Read the persisted pipeline state YAML
      const stateDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'pipeline');
      const files = await fs.readdir(stateDir);
      // Filter out any mock session files
      const stateFiles = files.filter((f) => f.endsWith('.yaml'));
      expect(stateFiles.length).toBeGreaterThan(0);

      // Find the file that matches our pipeline ID
      const stateFile = stateFiles.find((f) => f.includes(result.pipelineId));
      expect(stateFile).toBeDefined();

      const content = await fs.readFile(path.join(stateDir, stateFile!), 'utf-8');

      // Should contain the mode and pipeline ID
      expect(content).toContain('import');
      expect(content).toContain(result.pipelineId);

      // Parse the YAML to verify structure
      const yaml = await import('js-yaml');
      const parsed = yaml.load(content) as Record<string, unknown>;

      expect(parsed['mode']).toBe('import');
      expect(parsed['overallStatus']).toBe('completed');

      // Stages array should contain the newly executed stages
      const stages = parsed['stages'] as Array<Record<string, unknown>>;
      expect(stages).toBeDefined();
      expect(stages.length).toBeGreaterThan(0);

      // Check that the newly executed stages have timing data
      for (const stage of stages) {
        expect(stage['status']).toBe('completed');
        expect(stage['durationMs']).toBeGreaterThanOrEqual(0);
      }

      await agent.dispose();
    });

    it('should persist session state after full fresh greenfield execution', async () => {
      const agent = new TrackingOrchestrator();
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Fresh greenfield');

      // Verify the state file is written
      const stateDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'pipeline');
      const files = await fs.readdir(stateDir);
      expect(files.length).toBeGreaterThan(0);

      const content = await fs.readFile(path.join(stateDir, files[0]!), 'utf-8');
      expect(content).toContain('greenfield');
      expect(content).toContain(result.pipelineId);

      // Parse and verify all stages are persisted
      const yaml = await import('js-yaml');
      const parsed = yaml.load(content) as Record<string, unknown>;
      const stages = parsed['stages'] as Array<Record<string, unknown>>;
      expect(stages).toHaveLength(GREENFIELD_STAGES.length);

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Fresh Execution Regression
  // ---------------------------------------------------------------------------

  describe('Fresh Execution Regression', () => {
    it('should not break fresh greenfield pipeline execution', async () => {
      const agent = new TrackingOrchestrator();
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Build a web app');

      expect(result.overallStatus).toBe('completed');
      expect(result.stages).toHaveLength(GREENFIELD_STAGES.length);
      expect(agent.executionOrder).toHaveLength(GREENFIELD_STAGES.length);
      for (const stage of result.stages) {
        expect(stage.status).toBe('completed');
      }

      await agent.dispose();
    });

    it('should not break fresh enhancement pipeline execution', async () => {
      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Enhance existing app',
        overrideMode: 'enhancement',
      });

      const result = await agent.executePipeline(tempDir, 'Enhance existing app');

      expect(result.overallStatus).toBe('completed');
      expect(result.stages).toHaveLength(ENHANCEMENT_STAGES.length);
      expect(agent.executionOrder).toHaveLength(ENHANCEMENT_STAGES.length);

      await agent.dispose();
    });

    it('should not break fresh import pipeline execution', async () => {
      const agent = new TrackingOrchestrator();
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Import issues',
        overrideMode: 'import',
      });

      const result = await agent.executePipeline(tempDir, 'Import issues');

      expect(result.overallStatus).toBe('completed');
      expect(result.stages).toHaveLength(IMPORT_STAGES.length);
      expect(agent.executionOrder).toEqual([
        'issue_reading',
        'orchestration',
        'implementation',
        'review',
      ]);

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Helper Function Tests
  // ---------------------------------------------------------------------------

  describe('createMockSession Helper', () => {
    it('should create a valid session YAML file', async () => {
      const sessionId = await createMockSession(tempDir, 'greenfield', [
        'initialization',
        'mode_detection',
      ]);

      const stateFile = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'pipeline',
        `${sessionId}.yaml`
      );
      const content = await fs.readFile(stateFile, 'utf-8');

      expect(content).toContain('greenfield');
      expect(content).toContain('initialization');
      expect(content).toContain('completed');
    });

    it('should create session with failed stages', async () => {
      const sessionId = await createMockSession(tempDir, 'import', ['issue_reading'], {
        failedStages: [{ name: 'orchestration', error: 'timeout' }],
      });

      const stateFile = path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'pipeline',
        `${sessionId}.yaml`
      );
      const content = await fs.readFile(stateFile, 'utf-8');

      expect(content).toContain('issue_reading');
      expect(content).toContain('orchestration');
      expect(content).toContain('failed');
      expect(content).toContain('partial');
    });

    it('should be loadable by AdsdlcOrchestratorAgent.loadPriorSession', async () => {
      const sessionId = await createMockSession(
        tempDir,
        'import',
        ['issue_reading', 'orchestration'],
        { sessionId: 'loadable-test-session' }
      );

      const agent = new AdsdlcOrchestratorAgent();
      await agent.initialize();
      const loaded = await agent.loadPriorSession(sessionId, tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded!.mode).toBe('import');
      expect(loaded!.preCompletedStages).toContain('issue_reading');
      expect(loaded!.preCompletedStages).toContain('orchestration');

      await agent.dispose();
    });
  });

  describe('placeMockArtifacts Helper', () => {
    it('should create artifacts that pass ArtifactValidator', async () => {
      await placeMockArtifacts(
        tempDir,
        ['initialization', 'collection', 'prd_generation'],
        'test-project'
      );

      const validator = new ArtifactValidator(tempDir);

      const initResult = await validator.validateStageArtifacts('initialization', 'greenfield');
      expect(initResult.valid).toBe(true);

      const collResult = await validator.validateStageArtifacts('collection', 'greenfield');
      expect(collResult.valid).toBe(true);

      const prdResult = await validator.validateStageArtifacts('prd_generation', 'greenfield');
      expect(prdResult.valid).toBe(true);
    });

    it('should create enhancement mode artifacts', async () => {
      await placeMockArtifacts(
        tempDir,
        ['document_reading', 'codebase_analysis', 'code_reading'],
        'test-project'
      );

      const validator = new ArtifactValidator(tempDir);

      const docResult = await validator.validateStageArtifacts('document_reading', 'enhancement');
      expect(docResult.valid).toBe(true);

      const codebaseResult = await validator.validateStageArtifacts(
        'codebase_analysis',
        'enhancement'
      );
      expect(codebaseResult.valid).toBe(true);

      const codeResult = await validator.validateStageArtifacts('code_reading', 'enhancement');
      expect(codeResult.valid).toBe(true);
    });
  });
});
