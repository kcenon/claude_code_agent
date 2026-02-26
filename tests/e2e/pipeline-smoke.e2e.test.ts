/**
 * E2E Smoke Tests for Greenfield Pipeline Execution
 *
 * Validates end-to-end orchestrator behavior using mock agent responses
 * to ensure the pipeline executes stages in correct order, persists state,
 * handles resume, and degrades gracefully on failure.
 *
 * Part of Epic #540 — Pipeline Activation Phase 2
 * @see https://github.com/kcenon/claude_code_agent/issues/547
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
import { PipelineFailedError } from '../../src/ad-sdlc-orchestrator/errors.js';
import { GREENFIELD_STAGES } from '../../src/ad-sdlc-orchestrator/types.js';
import type {
  PipelineStageDefinition,
  OrchestratorSession,
  StageName,
} from '../../src/ad-sdlc-orchestrator/types.js';

import { GREENFIELD_RESPONSES } from './fixtures/pipeline-fixtures.js';
import { createMockInvoker } from './helpers/MockBridge.js';
import type { MockResponseMap } from './helpers/MockBridge.js';

// =============================================================================
// Test Orchestrator Subclasses
// =============================================================================

/**
 * ArtifactValidator that treats all stages as valid (bypasses filesystem check).
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
 * Orchestrator that uses MockBridge responses for agent invocations.
 * Tracks execution order and bypasses artifact validation.
 */
class MockOrchestrator extends AdsdlcOrchestratorAgent {
  public readonly executionOrder: string[] = [];
  private readonly mockInvoker: (
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ) => Promise<string>;

  constructor(responses: MockResponseMap = GREENFIELD_RESPONSES) {
    super({
      maxRetries: 1,
      timeouts: { default: 30_000 },
    });
    this.mockInvoker = createMockInvoker(responses);
  }

  protected override async invokeAgent(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<string> {
    this.executionOrder.push(stage.name);
    return this.mockInvoker(stage, session);
  }

  protected override createArtifactValidator(): ArtifactValidator {
    return new NoOpArtifactValidator();
  }

  /** Skip exponential backoff in tests */
  protected override sleep(_ms: number): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Orchestrator that fails specific stages on demand.
 *
 * @param failStages - Map of stage names to error messages.
 *   If a stage name is in this map, the corresponding invocation throws.
 *   Otherwise it falls through to the normal mock response.
 */
class FailingOrchestrator extends MockOrchestrator {
  private readonly failStages: Map<string, string>;
  private readonly invocationCounts = new Map<string, number>();

  constructor(
    failStages: Record<string, string>,
    responses: MockResponseMap = GREENFIELD_RESPONSES
  ) {
    super(responses);
    this.failStages = new Map(Object.entries(failStages));
  }

  protected override async invokeAgent(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<string> {
    this.executionOrder.push(stage.name);
    const count = (this.invocationCounts.get(stage.name) ?? 0) + 1;
    this.invocationCounts.set(stage.name, count);

    const errorMsg = this.failStages.get(stage.name);
    if (errorMsg !== undefined) {
      throw new Error(errorMsg);
    }
    return createMockInvoker(GREENFIELD_RESPONSES)(stage, session);
  }

  /** Get the number of times a stage was invoked */
  getInvocationCount(stageName: string): number {
    return this.invocationCounts.get(stageName) ?? 0;
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Pipeline Smoke E2E', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-smoke-e2e-'));
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
  // 1. Full Greenfield Pipeline Execution
  // ---------------------------------------------------------------------------

  describe('Full Greenfield Pipeline', () => {
    it('should execute all stages in dependency order', async () => {
      const agent = new MockOrchestrator();
      await agent.initialize();

      const result = await agent.executePipeline(
        tempDir,
        'Build a simple web application with login and dashboard'
      );

      expect(result.overallStatus).toBe('completed');
      expect(result.mode).toBe('greenfield');
      expect(result.stages).toHaveLength(GREENFIELD_STAGES.length);

      // Every stage should have completed
      for (const stage of result.stages) {
        expect(stage.status).toBe('completed');
        expect(stage.durationMs).toBeGreaterThanOrEqual(0);
        expect(stage.retryCount).toBe(0);
      }

      // Execution order should match GREENFIELD_STAGES dependency order
      expect(agent.executionOrder).toHaveLength(GREENFIELD_STAGES.length);
      expect(agent.executionOrder[0]).toBe('initialization');
      expect(agent.executionOrder[agent.executionOrder.length - 1]).toBe('review');

      // Verify dependency ordering constraints
      const indexOf = (name: string) => agent.executionOrder.indexOf(name);
      expect(indexOf('mode_detection')).toBeGreaterThan(indexOf('initialization'));
      expect(indexOf('collection')).toBeGreaterThan(indexOf('mode_detection'));
      expect(indexOf('prd_generation')).toBeGreaterThan(indexOf('collection'));
      expect(indexOf('srs_generation')).toBeGreaterThan(indexOf('prd_generation'));
      expect(indexOf('sds_generation')).toBeGreaterThan(indexOf('github_repo_setup'));
      expect(indexOf('issue_generation')).toBeGreaterThan(indexOf('sds_generation'));
      expect(indexOf('review')).toBeGreaterThan(indexOf('implementation'));

      await agent.dispose();
    });

    it('should produce non-empty output for each stage', async () => {
      const agent = new MockOrchestrator();
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Build a web app');

      for (const stage of result.stages) {
        expect(stage.output).toBeDefined();
        expect(stage.output.length).toBeGreaterThan(0);
      }

      await agent.dispose();
    });

    it('should persist pipeline state to scratchpad', async () => {
      const agent = new MockOrchestrator();
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Build a web app');

      // Verify the YAML state file was written
      const stateDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'pipeline');
      const files = await fs.readdir(stateDir);
      expect(files.length).toBeGreaterThan(0);

      const stateFile = files.find((f) => f.includes(result.pipelineId));
      expect(stateFile).toBeDefined();

      const content = await fs.readFile(path.join(stateDir, stateFile!), 'utf-8');
      expect(content).toContain('greenfield');
      expect(content).toContain('completed');
      expect(content).toContain(result.pipelineId);

      await agent.dispose();
    });

    it('should report correct timing in pipeline result', async () => {
      const agent = new MockOrchestrator();
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Build a web app');

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.pipelineId).toBeDefined();
      expect(result.projectId).toBe(path.basename(tempDir));
      expect(result.warnings).toHaveLength(0);

      await agent.dispose();
    });

    it('should track session state through execution lifecycle', async () => {
      const agent = new MockOrchestrator();
      await agent.initialize();

      // Before execution — no session
      expect(agent.getSession()).toBeNull();
      expect(agent.getStatus().status).toBe('pending');

      await agent.executePipeline(tempDir, 'Build a web app');

      // After execution — session shows completed
      const session = agent.getSession();
      expect(session).not.toBeNull();
      expect(session!.status).toBe('completed');
      expect(session!.mode).toBe('greenfield');
      expect(session!.stageResults.length).toBe(GREENFIELD_STAGES.length);

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Pipeline Resume from Checkpoint
  // ---------------------------------------------------------------------------

  describe('Pipeline Resume from Checkpoint', () => {
    it('should resume and skip already-completed stages', async () => {
      // Phase 1: Run a full pipeline to create a persisted session
      const agent1 = new MockOrchestrator();
      await agent1.initialize();
      const firstResult = await agent1.executePipeline(tempDir, 'Build a web app');
      const sessionId = firstResult.pipelineId;
      await agent1.dispose();

      // Phase 2: Resume — all stages were completed, nothing should re-execute
      const agent2 = new MockOrchestrator();
      await agent2.initialize();

      await agent2.startSession({
        projectDir: tempDir,
        userRequest: 'Continue build',
        resumeSessionId: sessionId,
      });

      const resumeResult = await agent2.executePipeline(tempDir, 'Continue build');

      expect(resumeResult.overallStatus).toBe('completed');
      expect(agent2.executionOrder).toHaveLength(0);

      await agent2.dispose();
    });

    it('should resume from a specific stage with pre-completed stages', async () => {
      const agent = new MockOrchestrator();
      await agent.initialize();

      // Start from sds_generation — everything before is pre-completed
      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Start from SDS generation',
        overrideMode: 'greenfield',
        startFromStage: 'sds_generation' as StageName,
      });

      const result = await agent.executePipeline(tempDir, 'Start from SDS generation');

      expect(result.overallStatus).toBe('completed');

      // Stages before sds_generation should NOT have been executed
      expect(agent.executionOrder).not.toContain('initialization');
      expect(agent.executionOrder).not.toContain('collection');
      expect(agent.executionOrder).not.toContain('prd_generation');
      expect(agent.executionOrder).not.toContain('srs_generation');

      // sds_generation and downstream stages should have executed
      expect(agent.executionOrder).toContain('sds_generation');
      expect(agent.executionOrder).toContain('issue_generation');
      expect(agent.executionOrder).toContain('review');

      await agent.dispose();
    });

    it('should find and load the latest session for a project directory', async () => {
      // Create a completed pipeline session
      const agent1 = new MockOrchestrator();
      await agent1.initialize();
      const result1 = await agent1.executePipeline(tempDir, 'First run');
      await agent1.dispose();

      // Find the latest session
      const agent2 = new AdsdlcOrchestratorAgent();
      await agent2.initialize();
      const latestSessionId = await agent2.findLatestSession(tempDir);

      expect(latestSessionId).toBe(result1.pipelineId);

      await agent2.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Agent Failure with Retry and Graceful Degradation
  // ---------------------------------------------------------------------------

  describe('Agent Failure and Graceful Degradation', () => {
    it('should retry a failing stage up to maxRetries', async () => {
      // Fail the issue_generation stage.
      // The orchestrator uses graceful degradation: when some stages fail
      // but others succeed, overallStatus is 'partial' (not 'failed'),
      // so executePipeline returns normally instead of throwing.
      const agent = new FailingOrchestrator({
        'issue_generation': 'Simulated issue generation failure',
      });
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Build a web app');

      expect(result.overallStatus).toBe('partial');

      // maxRetries=1, so the stage should be invoked twice (initial + 1 retry)
      expect(agent.getInvocationCount('issue_generation')).toBe(2);

      // The stage should be marked as failed in results
      const failedStage = result.stages.find((s) => s.name === 'issue_generation');
      expect(failedStage).toBeDefined();
      expect(failedStage!.status).toBe('failed');
      expect(failedStage!.error).toContain('Simulated issue generation failure');

      await agent.dispose();
    });

    it('should skip downstream stages when a dependency fails', async () => {
      // Fail sds_generation — issue_generation, orchestration, implementation, review depend on it.
      // With graceful degradation, completed + failed + skipped stages coexist
      // and the pipeline returns 'partial' instead of throwing.
      const agent = new FailingOrchestrator({
        'sds_generation': 'SDS generation crashed',
      });
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Build a web app');

      expect(result.overallStatus).toBe('partial');

      // Stages before sds_generation should have completed
      const completed = result.stages.filter((s) => s.status === 'completed');
      const completedNames = completed.map((s) => s.name);
      expect(completedNames).toContain('initialization');
      expect(completedNames).toContain('prd_generation');
      expect(completedNames).toContain('srs_generation');

      // sds_generation should be marked as failed
      const failed = result.stages.filter((s) => s.status === 'failed');
      expect(failed.map((s) => s.name)).toContain('sds_generation');

      // Downstream stages should be skipped
      const skipped = result.stages.filter((s) => s.status === 'skipped');
      const skippedNames = skipped.map((s) => s.name);
      expect(skippedNames).toContain('issue_generation');
      expect(skippedNames).toContain('orchestration');
      expect(skippedNames).toContain('implementation');
      expect(skippedNames).toContain('review');

      await agent.dispose();
    });

    it('should report partial status when early stages succeed but later stages fail', async () => {
      // Fail the review stage (last stage, stage name = 'review') — all others succeed.
      // Since some stages completed and one failed, overallStatus is 'partial'.
      const agent = new FailingOrchestrator({
        'review': 'Review agent unavailable',
      });
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Build a web app');

      expect(result.overallStatus).toBe('partial');

      // All stages except review should be completed
      const completed = result.stages.filter((s) => s.status === 'completed');
      expect(completed.length).toBe(GREENFIELD_STAGES.length - 1);

      // Review should be failed
      const failed = result.stages.find((s) => s.name === 'review');
      expect(failed).toBeDefined();
      expect(failed!.status).toBe('failed');
      expect(failed!.error).toContain('Review agent unavailable');

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Pipeline Monitor Snapshot
  // ---------------------------------------------------------------------------

  describe('Pipeline Monitoring', () => {
    it('should provide accurate monitor snapshot after execution', async () => {
      const agent = new MockOrchestrator();
      await agent.initialize();

      await agent.executePipeline(tempDir, 'Build a web app');

      const snapshot = agent.monitorPipeline();

      expect(snapshot.mode).toBe('greenfield');
      expect(snapshot.status).toBe('completed');
      expect(snapshot.totalStages).toBe(GREENFIELD_STAGES.length);
      expect(snapshot.completedStages).toBe(GREENFIELD_STAGES.length);
      expect(snapshot.failedStages).toBe(0);
      expect(snapshot.skippedStages).toBe(0);
      expect(snapshot.currentStage).toBeNull();
      expect(snapshot.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(snapshot.stageSummaries).toHaveLength(GREENFIELD_STAGES.length);

      for (const summary of snapshot.stageSummaries) {
        expect(summary.status).toBe('completed');
        expect(summary.durationMs).toBeGreaterThanOrEqual(0);
        expect(summary.retryCount).toBe(0);
      }

      await agent.dispose();
    });

    it('should return empty snapshot before pipeline starts', async () => {
      const agent = new MockOrchestrator();
      await agent.initialize();

      const snapshot = agent.monitorPipeline();

      expect(snapshot.sessionId).toBe('');
      expect(snapshot.status).toBe('pending');
      expect(snapshot.totalStages).toBe(0);
      expect(snapshot.stageSummaries).toHaveLength(0);

      await agent.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Dynamic MockBridge Responses
  // ---------------------------------------------------------------------------

  describe('Dynamic Mock Responses', () => {
    it('should support function-based mock responses', async () => {
      const dynamicResponses: MockResponseMap = {
        ...GREENFIELD_RESPONSES,
        'collector': (stage, session) => {
          return JSON.stringify({
            stage: stage.name,
            userRequest: session.userRequest,
            collected: true,
          });
        },
      };

      const agent = new MockOrchestrator(dynamicResponses);
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Dynamic test request');

      expect(result.overallStatus).toBe('completed');

      // Verify the collector stage used the dynamic response
      const collectorStage = result.stages.find((s) => s.name === 'collection');
      expect(collectorStage).toBeDefined();
      expect(collectorStage!.output).toContain('Dynamic test request');

      await agent.dispose();
    });
  });
});

// =============================================================================
// Live Integration Test (requires ANTHROPIC_API_KEY)
// =============================================================================

describe.skipIf(!process.env['ANTHROPIC_API_KEY'])('Live Pipeline Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-live-e2e-'));
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

  it(
    'should generate a PRD from natural language using live agents',
    async () => {
      // This test uses real agents with the ANTHROPIC_API_KEY.
      // It verifies that the collector and PRD writer agents produce
      // meaningful output from a natural language description.
      const { CollectorAgent } = await import('../../src/collector/index.js');
      const { PRDWriterAgent } = await import('../../src/prd-writer/index.js');

      const scratchpadPath = path.join(tempDir, '.ad-sdlc', 'scratchpad');
      await fs.mkdir(path.join(scratchpadPath, 'info'), { recursive: true });
      await fs.mkdir(path.join(scratchpadPath, 'documents'), { recursive: true });
      const publicDocsPath = path.join(tempDir, 'docs', 'prd');
      await fs.mkdir(publicDocsPath, { recursive: true });

      // Stage 1: Collect requirements
      const collector = new CollectorAgent({
        scratchpadBasePath: scratchpadPath,
        skipClarificationIfConfident: true,
        confidenceThreshold: 0.5,
      });

      const collectionResult = await collector.collectFromText(
        'Build a simple REST API that returns the current server time in ISO 8601 format.',
        { projectName: 'Time API' }
      );

      expect(collectionResult.success).toBe(true);
      expect(collectionResult.projectId).toBeDefined();

      // Stage 2: Generate PRD
      const prdWriter = new PRDWriterAgent({
        scratchpadBasePath: scratchpadPath,
        publicDocsPath,
        failOnCriticalGaps: false,
      });

      const prdResult = await prdWriter.generateFromProject(collectionResult.projectId);

      expect(prdResult.success).toBe(true);

      // Verify PRD file was written
      const docsDir = path.join(scratchpadPath, 'documents', collectionResult.projectId);
      const files = await fs.readdir(docsDir);
      const prdFile = files.find((f) => f.includes('prd'));
      expect(prdFile).toBeDefined();
    },
    120_000 // 2 minutes for live API calls
  );
});
