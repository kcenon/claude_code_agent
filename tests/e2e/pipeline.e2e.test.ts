/**
 * End-to-End Pipeline Integration Tests
 *
 * Tests the complete AD-SDLC pipeline from user input to generated issues.
 * Validates that all agents work together correctly and produce expected outputs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  resetAllAgents,
  type TestEnvironment,
} from './helpers/test-environment.js';
import { runPipeline, runDocumentPipeline } from './helpers/pipeline-runner.js';
import { verifyPipeline, verifyIssueDependencies } from './helpers/verification.js';
import {
  SIMPLE_FEATURE_INPUT,
  MEDIUM_FEATURE_INPUT,
  COMPLEX_FEATURE_INPUT,
  FIXTURE_EXPECTATIONS,
} from './helpers/fixtures.js';
import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { PipelineFailedError } from '../../src/ad-sdlc-orchestrator/errors.js';
import {
  GREENFIELD_STAGES,
  type OrchestratorSession,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { MockExecutionAdapter } from '../../src/execution/MockExecutionAdapter.js';
import type { ExecutionAdapter } from '../../src/execution/types.js';

describe('E2E Pipeline Integration', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    await resetAllAgents();
    env = await createTestEnvironment({
      baseName: 'e2e-pipeline',
      initScratchpad: true,
    });
  });

  afterEach(async () => {
    await env.cleanup();
    await resetAllAgents();
  });

  describe('Simple Feature Flow', () => {
    it('runs the production pipeline for a single feature request', async () => {
      const adapter = new MockExecutionAdapter({
        handlers: [
          {
            match: () => true,
            respond: (request) => ({
              status: 'success',
              artifacts: [{ path: `artifacts/${request.agentType}.md` }],
              sessionId: `session-${request.agentType}`,
              toolCallCount: 1,
              tokenUsage: { input: 10, output: 5, cache: 0 },
            }),
          },
        ],
      });

      class PipelineOrchestrator extends AdsdlcOrchestratorAgent {
        protected override createExecutionAdapter(_session: OrchestratorSession): ExecutionAdapter {
          return adapter;
        }
      }

      const orchestrator = new PipelineOrchestrator({ maxRetries: 0, maxParallelAgents: 2 });
      await orchestrator.startSession({
        projectDir: env.rootDir,
        userRequest: SIMPLE_FEATURE_INPUT,
        overrideMode: 'greenfield',
      });

      const result = await orchestrator.executePipeline(env.rootDir, SIMPLE_FEATURE_INPUT);

      expect(result.overallStatus).toBe('completed');
      expect(result.stages.map((stage) => stage.name)).toEqual(
        GREENFIELD_STAGES.map((stage) => stage.name)
      );
      expect(result.artifacts).toEqual(
        GREENFIELD_STAGES.map((stage) => `artifacts/${stage.agentType}.md`)
      );
      expect(Object.keys(adapter.calls.at(-1)?.priorOutputs ?? {})).toEqual(
        GREENFIELD_STAGES.slice(0, -1).map((stage) => stage.name)
      );
      expect(result.verificationResults).toHaveLength(GREENFIELD_STAGES.length);
      await orchestrator.dispose();
    }, 60000);

    it('should generate valid issues from simple feature', async () => {
      // Given: A simple feature request
      const input = SIMPLE_FEATURE_INPUT;

      // When: Running the complete pipeline with issue generation
      const result = await runPipeline(env, input, {
        projectName: 'Login Feature',
        skipClarification: true,
        generateIssues: true,
      });

      // Then: Issues should be generated
      expect(result.success).toBe(true);
      expect(result.issues).toBeDefined();

      if (result.issues) {
        const issueCount = result.issues.issues.length;
        expect(issueCount).toBeGreaterThanOrEqual(FIXTURE_EXPECTATIONS.simple.expectedIssues.min);
        expect(issueCount).toBeLessThanOrEqual(FIXTURE_EXPECTATIONS.simple.expectedIssues.max);

        // Verify issue dependencies are valid
        const depCheck = verifyIssueDependencies(env, result.projectId);
        expect(depCheck.valid).toBe(true);
      }
    }, 60000);
  });

  describe('Medium Feature Flow', () => {
    it('should handle multiple requirements with dependency chain', async () => {
      // Given: A medium complexity feature request
      const input = MEDIUM_FEATURE_INPUT;

      // When: Running the complete pipeline
      const result = await runPipeline(env, input, {
        projectName: 'User Dashboard',
        skipClarification: true,
        generateIssues: true,
      });

      // Then: Pipeline should complete successfully
      expect(result.success).toBe(true);

      // Verify documents were generated
      const verification = verifyPipeline(env, result);
      expect(verification.allStagesCompleted).toBe(true);
      expect(verification.documentsGenerated.collectedInfo).toBe(true);
      expect(verification.documentsGenerated.prd).toBe(true);
      expect(verification.documentsGenerated.srs).toBe(true);
      expect(verification.documentsGenerated.sds).toBe(true);

      // Verify issue count is in expected range
      if (result.issues) {
        const issueCount = result.issues.issues.length;
        expect(issueCount).toBeGreaterThanOrEqual(FIXTURE_EXPECTATIONS.medium.expectedIssues.min);
      }
    }, 90000);

    it('should maintain document traceability for medium feature', async () => {
      // Given: A medium complexity feature request
      const input = MEDIUM_FEATURE_INPUT;

      // When: Running the document pipeline
      const result = await runDocumentPipeline(env, input, {
        projectName: 'User Dashboard',
        skipClarification: true,
      });

      // Then: Traceability should be maintained
      expect(result.success).toBe(true);

      const verification = verifyPipeline(env, result);
      expect(verification.traceability.prdToSrs).toBe(true);
      expect(verification.traceability.srsToSds).toBe(true);
    }, 60000);
  });

  describe('Complex Feature Flow', () => {
    it('should process complex requirements with many components', async () => {
      // Given: A complex feature request
      const input = COMPLEX_FEATURE_INPUT;

      // When: Running the complete pipeline
      const result = await runPipeline(env, input, {
        projectName: 'E-commerce Checkout',
        skipClarification: true,
        generateIssues: true,
      });

      // Then: Pipeline should complete successfully
      expect(result.success).toBe(true);

      // Verify all stages have timing data
      expect(result.timing.collection).toBeDefined();
      expect(result.timing.prd).toBeDefined();
      expect(result.timing.srs).toBeDefined();
      expect(result.timing.sds).toBeDefined();
      expect(result.timing.issues).toBeDefined();

      // Verify timing is within bounds
      expect(result.totalTimeMs).toBeLessThan(FIXTURE_EXPECTATIONS.complex.maxTimeMs);
    }, 120000);

    it('should generate appropriate number of issues for complex feature', async () => {
      // Given: A complex feature request
      const input = COMPLEX_FEATURE_INPUT;

      // When: Running the complete pipeline
      const result = await runPipeline(env, input, {
        projectName: 'E-commerce Checkout',
        skipClarification: true,
        generateIssues: true,
      });

      // Then: Issues should be in expected range
      expect(result.success).toBe(true);
      expect(result.issues).toBeDefined();

      if (result.issues) {
        const issueCount = result.issues.issues.length;
        expect(issueCount).toBeGreaterThanOrEqual(FIXTURE_EXPECTATIONS.complex.expectedIssues.min);
      }
    }, 120000);
  });

  describe('Document Pipeline Only', () => {
    it('should generate documents without issues', async () => {
      // Given: A simple feature request
      const input = SIMPLE_FEATURE_INPUT;

      // When: Running only the document pipeline
      const result = await runDocumentPipeline(env, input, {
        projectName: 'Login Feature',
        skipClarification: true,
      });

      // Then: Documents should be generated, but not issues
      expect(result.success).toBe(true);
      expect(result.collection).toBeDefined();
      expect(result.prd).toBeDefined();
      expect(result.srs).toBeDefined();
      expect(result.sds).toBeDefined();
      expect(result.issues).toBeUndefined();
    }, 60000);
  });

  describe('Production Orchestrator Path', () => {
    it('halts the production DAG when the real strict verifier rejects a stage', async () => {
      const adapter = new MockExecutionAdapter();

      class StrictOrchestrator extends AdsdlcOrchestratorAgent {
        protected override createExecutionAdapter(_session: OrchestratorSession): ExecutionAdapter {
          return adapter;
        }
      }

      const orchestrator = new StrictOrchestrator({
        maxRetries: 0,
        vnv: { rigor: 'strict', haltOnVerificationFailure: true },
      });
      await orchestrator.startSession({
        projectDir: env.rootDir,
        userRequest: 'Execute imported work',
        overrideMode: 'import',
      });

      await expect(
        orchestrator.executePipeline(env.rootDir, 'Execute imported work')
      ).rejects.toBeInstanceOf(PipelineFailedError);

      expect(adapter.calls.map((request) => request.agentType)).toEqual([
        'issue-reader',
        'controller',
        'worker',
      ]);
      expect(orchestrator.getStatus().stages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'implementation', status: 'failed' }),
          expect.objectContaining({ name: 'validation-agent', status: 'skipped' }),
          expect.objectContaining({ name: 'review', status: 'skipped' }),
        ])
      );
      await orchestrator.dispose();
    });
  });

  describe('Pipeline Timing Benchmarks', () => {
    it('should complete simple pipeline within benchmark time', async () => {
      const input = SIMPLE_FEATURE_INPUT;

      const result = await runPipeline(env, input, {
        projectName: 'Benchmark Test',
        skipClarification: true,
        generateIssues: true,
      });

      expect(result.success).toBe(true);

      // Verify individual stage timing
      expect(result.timing.collection).toBeLessThan(10000); // 10s for collection
      expect(result.timing.prd).toBeLessThan(10000); // 10s for PRD
      expect(result.timing.srs).toBeLessThan(10000); // 10s for SRS
      expect(result.timing.sds).toBeLessThan(10000); // 10s for SDS
    }, 60000);
  });
});
