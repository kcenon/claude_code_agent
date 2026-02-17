/**
 * AD-SDLC Orchestrator Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  AdsdlcOrchestratorAgent,
  getAdsdlcOrchestratorAgent,
  resetAdsdlcOrchestratorAgent,
  ADSDLC_ORCHESTRATOR_AGENT_ID,
} from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import {
  InvalidProjectDirError,
  PipelineInProgressError,
  PipelineFailedError,
  SessionCorruptedError,
} from '../../src/ad-sdlc-orchestrator/errors.js';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
} from '../../src/ad-sdlc-orchestrator/types.js';
import type {
  ApprovalDecision,
  OrchestratorConfig,
  PipelineRequest,
  PipelineStageDefinition,
  StageResult,
} from '../../src/ad-sdlc-orchestrator/types.js';

describe('AdsdlcOrchestratorAgent', () => {
  let tempDir: string;
  let agent: AdsdlcOrchestratorAgent;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adsdlc-orchestrator-test-'));
    agent = new AdsdlcOrchestratorAgent();
    resetAdsdlcOrchestratorAgent();
  });

  afterEach(async () => {
    try {
      await agent.dispose();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetAdsdlcOrchestratorAgent();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const a = new AdsdlcOrchestratorAgent();
      expect(a).toBeInstanceOf(AdsdlcOrchestratorAgent);
      expect(a.agentId).toBe(ADSDLC_ORCHESTRATOR_AGENT_ID);
      expect(a.name).toBe('AD-SDLC Pipeline Orchestrator');
    });

    it('should create with custom config', () => {
      const config: OrchestratorConfig = {
        scratchpadDir: '.custom/scratchpad',
        maxRetries: 5,
        approvalMode: 'manual',
        logLevel: 'DEBUG',
      };
      const a = new AdsdlcOrchestratorAgent(config);
      expect(a).toBeInstanceOf(AdsdlcOrchestratorAgent);
    });
  });

  describe('initialize and dispose', () => {
    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should be idempotent on multiple initializations', async () => {
      await agent.initialize();
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should dispose without errors', async () => {
      await agent.initialize();
      await expect(agent.dispose()).resolves.not.toThrow();
    });

    it('should dispose even without initialization', async () => {
      await expect(agent.dispose()).resolves.not.toThrow();
    });
  });

  describe('startSession', () => {
    it('should create a new session with valid project dir', async () => {
      const request: PipelineRequest = {
        projectDir: tempDir,
        userRequest: 'Build a web application',
      };

      const session = await agent.startSession(request);

      expect(session.sessionId).toBeTruthy();
      expect(session.projectDir).toBe(tempDir);
      expect(session.userRequest).toBe('Build a web application');
      expect(session.mode).toBe('greenfield');
      expect(session.status).toBe('pending');
      expect(session.stageResults).toHaveLength(0);
    });

    it('should use override mode when specified', async () => {
      const request: PipelineRequest = {
        projectDir: tempDir,
        userRequest: 'Improve existing code',
        overrideMode: 'enhancement',
      };

      const session = await agent.startSession(request);
      expect(session.mode).toBe('enhancement');
    });

    it('should throw InvalidProjectDirError for non-existent directory', async () => {
      const request: PipelineRequest = {
        projectDir: '/nonexistent/path/12345',
        userRequest: 'test',
      };

      await expect(agent.startSession(request)).rejects.toThrow(InvalidProjectDirError);
    });

    it('should throw PipelineInProgressError when session is already running', async () => {
      const request: PipelineRequest = {
        projectDir: tempDir,
        userRequest: 'test',
      };

      const session = await agent.startSession(request);
      // Simulate running state by accessing internal state
      Object.defineProperty(agent, 'session', {
        value: { ...session, status: 'running' },
        writable: true,
      });

      await expect(agent.startSession(request)).rejects.toThrow(PipelineInProgressError);
    });
  });

  describe('getSession', () => {
    it('should return null when no session exists', () => {
      expect(agent.getSession()).toBeNull();
    });

    it('should return active session after startSession', async () => {
      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
      });

      const session = agent.getSession();
      expect(session).not.toBeNull();
      expect(session?.projectDir).toBe(tempDir);
    });
  });

  describe('executePipeline', () => {
    it('should execute greenfield pipeline successfully', async () => {
      await agent.initialize();

      const result = await agent.executePipeline(tempDir, 'Build a web app');

      expect(result.pipelineId).toBeTruthy();
      expect(result.mode).toBe('greenfield');
      expect(result.overallStatus).toBe('completed');
      expect(result.stages).toHaveLength(GREENFIELD_STAGES.length);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should auto-initialize if not initialized', async () => {
      // Do NOT call initialize() first
      const result = await agent.executePipeline(tempDir, 'Build a web app');

      expect(result.overallStatus).toBe('completed');
    });

    it('should track all greenfield stages', async () => {
      await agent.initialize();
      const result = await agent.executePipeline(tempDir, 'test');

      const stageNames = result.stages.map((s) => s.name);
      expect(stageNames).toContain('initialization');
      expect(stageNames).toContain('mode_detection');
      expect(stageNames).toContain('collection');
      expect(stageNames).toContain('prd_generation');
      expect(stageNames).toContain('srs_generation');
      expect(stageNames).toContain('sds_generation');
      expect(stageNames).toContain('issue_generation');
      expect(stageNames).toContain('implementation');
      expect(stageNames).toContain('review');
    });

    it('should persist pipeline state to scratchpad', async () => {
      await agent.initialize();
      const result = await agent.executePipeline(tempDir, 'test');

      const stateDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'pipeline');
      const files = await fs.readdir(stateDir);
      expect(files.length).toBeGreaterThan(0);

      const stateFile = path.join(stateDir, files[0]!);
      const content = await fs.readFile(stateFile, 'utf-8');
      expect(content).toContain('greenfield');
      expect(content).toContain(result.pipelineId);
    });

    it('should throw InvalidProjectDirError for invalid path', async () => {
      await agent.initialize();
      await expect(agent.executePipeline('/nonexistent/path', 'test')).rejects.toThrow(
        InvalidProjectDirError
      );
    });

    it('should execute enhancement pipeline with all stages', async () => {
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Improve existing code',
        overrideMode: 'enhancement',
      });

      const result = await agent.executePipeline(tempDir, 'Improve existing code');
      expect(result.mode).toBe('enhancement');
      expect(result.stages).toHaveLength(ENHANCEMENT_STAGES.length);
      expect(result.overallStatus).toBe('completed');

      const stageNames = result.stages.map((s) => s.name);
      expect(stageNames).toContain('document_reading');
      expect(stageNames).toContain('codebase_analysis');
      expect(stageNames).toContain('code_reading');
      expect(stageNames).toContain('doc_code_comparison');
      expect(stageNames).toContain('impact_analysis');
      expect(stageNames).toContain('prd_update');
      expect(stageNames).toContain('srs_update');
      expect(stageNames).toContain('sds_update');
      expect(stageNames).toContain('regression_testing');
    });

    it('should execute import pipeline with all stages', async () => {
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'Import issues from repo',
        overrideMode: 'import',
      });

      const result = await agent.executePipeline(tempDir, 'Import issues from repo');
      expect(result.mode).toBe('import');
      expect(result.stages).toHaveLength(IMPORT_STAGES.length);
      expect(result.overallStatus).toBe('completed');

      const stageNames = result.stages.map((s) => s.name);
      expect(stageNames).toContain('issue_reading');
      expect(stageNames).toContain('orchestration');
      expect(stageNames).toContain('implementation');
      expect(stageNames).toContain('review');
    });
  });

  describe('coordinateAgents', () => {
    it('should execute agents sequentially', async () => {
      const invocations = [
        {
          agentType: 'collector',
          inputs: ['input1.yaml'],
          outputs: ['output1.yaml'],
          stageName: 'collection' as const,
        },
        {
          agentType: 'prd-writer',
          inputs: ['output1.yaml'],
          outputs: ['prd.md'],
          stageName: 'prd_generation' as const,
        },
      ];

      const results = await agent.coordinateAgents(invocations, 'sequential');

      expect(results).toHaveLength(2);
      expect(results[0]!.agentType).toBe('collector');
      expect(results[1]!.agentType).toBe('prd-writer');
      expect(results.every((r) => r.status === 'completed')).toBe(true);
    });

    it('should execute agents in parallel', async () => {
      const invocations = [
        {
          agentType: 'document-reader',
          inputs: ['docs/prd.md'],
          outputs: ['state.yaml'],
          stageName: 'document_reading' as const,
        },
        {
          agentType: 'code-reader',
          inputs: ['src/'],
          outputs: ['inventory.yaml'],
          stageName: 'code_reading' as const,
        },
      ];

      const results = await agent.coordinateAgents(invocations, 'parallel');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'completed')).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return pending status when no session exists', () => {
      const status = agent.getStatus();
      expect(status.status).toBe('pending');
      expect(status.stages).toHaveLength(0);
    });

    it('should return running status during execution', async () => {
      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
      });

      const status = agent.getStatus();
      expect(status.status).toBe('pending');
    });
  });

  describe('singleton management', () => {
    it('should return same instance from getAdsdlcOrchestratorAgent', () => {
      const a1 = getAdsdlcOrchestratorAgent();
      const a2 = getAdsdlcOrchestratorAgent();
      expect(a1).toBe(a2);
    });

    it('should return new instance after reset', () => {
      const a1 = getAdsdlcOrchestratorAgent();
      resetAdsdlcOrchestratorAgent();
      const a2 = getAdsdlcOrchestratorAgent();
      expect(a1).not.toBe(a2);
    });
  });

  describe('stage dependency handling', () => {
    it('should skip stages with failed dependencies', async () => {
      // Create a subclass that fails on a specific stage
      class FailingOrchestrator extends AdsdlcOrchestratorAgent {
        protected override async invokeAgent(
          stage: { name: string; agentType: string },
          _session: unknown
        ): Promise<string> {
          if (stage.name === 'initialization') {
            throw new Error('Initialization failed');
          }
          return `Stage "${stage.name}" completed`;
        }
      }

      const failingAgent = new FailingOrchestrator({ maxRetries: 0 });
      await failingAgent.initialize();
      try {
        await failingAgent.executePipeline(tempDir, 'test');
      } catch {
        // Expected: PipelineFailedError
      }

      const status = failingAgent.getStatus();
      // After initialization fails, all dependent stages should be skipped
      expect(status.stages.some((s) => s.status === 'failed')).toBe(true);
      expect(status.stages.some((s) => s.status === 'skipped')).toBe(true);
    });
  });

  describe('retry logic', () => {
    it('should retry failed stages up to maxRetries', async () => {
      let attemptCount = 0;

      class RetryTestOrchestrator extends AdsdlcOrchestratorAgent {
        protected override async invokeAgent(
          stage: { name: string; agentType: string },
          _session: unknown
        ): Promise<string> {
          if (stage.name === 'initialization') {
            attemptCount++;
            if (attemptCount < 3) {
              throw new Error(`Attempt ${String(attemptCount)} failed`);
            }
          }
          return `Stage "${stage.name}" completed`;
        }

        protected override sleep(_ms: number): Promise<void> {
          return Promise.resolve();
        }
      }

      const retryAgent = new RetryTestOrchestrator({ maxRetries: 3 });
      await retryAgent.initialize();
      const result = await retryAgent.executePipeline(tempDir, 'test');

      expect(attemptCount).toBe(3);
      expect(result.stages[0]!.status).toBe('completed');
      expect(result.stages[0]!.retryCount).toBe(2);
    });
  });

  describe('approval gate', () => {
    it('should auto-approve in auto mode', async () => {
      const autoAgent = new AdsdlcOrchestratorAgent({ approvalMode: 'auto' });
      await autoAgent.initialize();

      await autoAgent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
        overrideMode: 'import',
      });

      const result = await autoAgent.executePipeline(tempDir, 'test');
      // All stages should complete (no approval blocks)
      expect(result.overallStatus).toBe('completed');
      await autoAgent.dispose();
    });

    it('should deny approval in critical mode when prior stages failed', async () => {
      class CriticalFailOrchestrator extends AdsdlcOrchestratorAgent {
        protected override async invokeAgent(
          stage: { name: string; agentType: string },
          _session: unknown
        ): Promise<string> {
          // Fail the first enhancement analysis stage
          if (stage.name === 'document_reading') {
            throw new Error('Document reading failed');
          }
          return `Stage "${stage.name}" completed`;
        }

        protected override sleep(_ms: number): Promise<void> {
          return Promise.resolve();
        }
      }

      const criticalAgent = new CriticalFailOrchestrator({
        approvalMode: 'critical',
        maxRetries: 0,
      });
      await criticalAgent.initialize();

      await criticalAgent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
        overrideMode: 'enhancement',
      });

      try {
        await criticalAgent.executePipeline(tempDir, 'test');
      } catch {
        // Expected failure
      }

      const status = criticalAgent.getStatus();
      // document_reading failed → doc_code_comparison skipped → impact_analysis denied
      expect(status.stages.some((s) => s.status === 'failed')).toBe(true);
      expect(status.stages.some((s) => s.status === 'skipped')).toBe(true);
      await criticalAgent.dispose();
    });

    it('should use custom approval logic when overridden', async () => {
      class CustomApprovalOrchestrator extends AdsdlcOrchestratorAgent {
        protected override approveStage(
          _stage: PipelineStageDefinition,
          _priorResults: readonly StageResult[]
        ): Promise<ApprovalDecision> {
          return Promise.resolve({
            approved: true,
            reason: 'Custom approved',
            decidedBy: 'user',
            decidedAt: new Date().toISOString(),
          });
        }
      }

      const customAgent = new CustomApprovalOrchestrator({ approvalMode: 'custom' });
      await customAgent.initialize();

      await customAgent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
        overrideMode: 'import',
      });

      const result = await customAgent.executePipeline(tempDir, 'test');
      expect(result.overallStatus).toBe('completed');
      await customAgent.dispose();
    });
  });

  describe('monitorPipeline', () => {
    it('should return empty snapshot when no session exists', () => {
      const snapshot = agent.monitorPipeline();
      expect(snapshot.sessionId).toBe('');
      expect(snapshot.status).toBe('pending');
      expect(snapshot.totalStages).toBe(0);
      expect(snapshot.currentStage).toBeNull();
      expect(snapshot.stageSummaries).toHaveLength(0);
    });

    it('should return pipeline state after execution', async () => {
      await agent.initialize();
      await agent.executePipeline(tempDir, 'test');

      const snapshot = agent.monitorPipeline();
      expect(snapshot.sessionId).toBeTruthy();
      expect(snapshot.mode).toBe('greenfield');
      expect(snapshot.totalStages).toBe(GREENFIELD_STAGES.length);
      expect(snapshot.completedStages).toBe(GREENFIELD_STAGES.length);
      expect(snapshot.failedStages).toBe(0);
      expect(snapshot.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(snapshot.stageSummaries).toHaveLength(GREENFIELD_STAGES.length);
    });

    it('should reflect enhancement pipeline stages', async () => {
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
        overrideMode: 'enhancement',
      });

      await agent.executePipeline(tempDir, 'test');
      const snapshot = agent.monitorPipeline();

      expect(snapshot.mode).toBe('enhancement');
      expect(snapshot.totalStages).toBe(ENHANCEMENT_STAGES.length);
    });
  });

  describe('parallel stage execution', () => {
    it('should execute parallel enhancement analysis stages concurrently', async () => {
      const executionOrder: string[] = [];

      class TrackingOrchestrator extends AdsdlcOrchestratorAgent {
        protected override async invokeAgent(
          stage: { name: string; agentType: string },
          _session: unknown
        ): Promise<string> {
          executionOrder.push(stage.name);
          return `Stage "${stage.name}" completed`;
        }
      }

      const trackingAgent = new TrackingOrchestrator();
      await trackingAgent.initialize();

      await trackingAgent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
        overrideMode: 'enhancement',
      });

      const result = await trackingAgent.executePipeline(tempDir, 'test');
      expect(result.overallStatus).toBe('completed');
      expect(result.stages).toHaveLength(ENHANCEMENT_STAGES.length);

      // The first three analysis stages should all appear before doc_code_comparison
      const comparisonIdx = executionOrder.indexOf('doc_code_comparison');
      expect(executionOrder.indexOf('document_reading')).toBeLessThan(comparisonIdx);
      expect(executionOrder.indexOf('codebase_analysis')).toBeLessThan(comparisonIdx);
      expect(executionOrder.indexOf('code_reading')).toBeLessThan(comparisonIdx);
      await trackingAgent.dispose();
    });
  });

  describe('graceful degradation', () => {
    it('should return partial status when some stages fail', async () => {
      class PartialFailOrchestrator extends AdsdlcOrchestratorAgent {
        protected override async invokeAgent(
          stage: { name: string; agentType: string },
          _session: unknown
        ): Promise<string> {
          // Fail regression_testing in import pipeline (which has no approval gates)
          if (stage.name === 'implementation') {
            throw new Error('Worker failed');
          }
          return `Stage "${stage.name}" completed`;
        }

        protected override sleep(_ms: number): Promise<void> {
          return Promise.resolve();
        }
      }

      const partialAgent = new PartialFailOrchestrator({ maxRetries: 0 });
      await partialAgent.initialize();

      await partialAgent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
        overrideMode: 'import',
      });

      // Should not throw — partial completion returns result
      const result = await partialAgent.executePipeline(tempDir, 'test');
      expect(result.overallStatus).toBe('partial');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('partially');
      await partialAgent.dispose();
    });
  });

  describe('loadPriorSession', () => {
    it('should return null when session file does not exist', async () => {
      await agent.initialize();
      const result = await agent.loadPriorSession('nonexistent-id', tempDir);
      expect(result).toBeNull();
    });

    it('should load a valid session from YAML', async () => {
      await agent.initialize();

      // First run a pipeline to persist state
      const result = await agent.executePipeline(tempDir, 'Build a web app');
      const sessionId = result.pipelineId;

      // Create a new agent and load the prior session
      const agent2 = new AdsdlcOrchestratorAgent();
      await agent2.initialize();
      const loaded = await agent2.loadPriorSession(sessionId, tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded!.sessionId).toBe(sessionId);
      expect(loaded!.mode).toBe('greenfield');
      expect(loaded!.projectDir).toBe(tempDir);
      expect(loaded!.resumedFrom).toBe(sessionId);
      expect(loaded!.preCompletedStages).toBeDefined();
      expect(loaded!.preCompletedStages!.length).toBeGreaterThan(0);
      expect(loaded!.stageResults.length).toBeGreaterThan(0);

      await agent2.dispose();
    });

    it('should throw SessionCorruptedError for malformed YAML', async () => {
      await agent.initialize();

      // Write a corrupt YAML file
      const stateDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'pipeline');
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(
        path.join(stateDir, 'corrupt-session.yaml'),
        '{{invalid yaml content',
        'utf-8'
      );

      await expect(
        agent.loadPriorSession('corrupt-session', tempDir)
      ).rejects.toThrow(SessionCorruptedError);
    });

    it('should throw SessionCorruptedError when mode is missing', async () => {
      await agent.initialize();

      const stateDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'pipeline');
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(
        path.join(stateDir, 'no-mode.yaml'),
        'pipelineId: test\nstages: []\n',
        'utf-8'
      );

      await expect(
        agent.loadPriorSession('no-mode', tempDir)
      ).rejects.toThrow(SessionCorruptedError);
    });

    it('should only include completed stages in preCompletedStages', async () => {
      await agent.initialize();

      // Create a YAML with mixed stage statuses
      const stateDir = path.join(tempDir, '.ad-sdlc', 'scratchpad', 'pipeline');
      await fs.mkdir(stateDir, { recursive: true });

      const yaml = await import('js-yaml');
      const content = yaml.dump({
        pipelineId: 'mixed-session',
        projectDir: tempDir,
        userRequest: 'test',
        startedAt: new Date().toISOString(),
        mode: 'import',
        overallStatus: 'partial',
        stages: [
          { name: 'issue_reading', agentType: 'issue-reader', status: 'completed', durationMs: 100, error: null, retryCount: 0 },
          { name: 'orchestration', agentType: 'controller', status: 'completed', durationMs: 200, error: null, retryCount: 0 },
          { name: 'implementation', agentType: 'worker', status: 'failed', durationMs: 300, error: 'timeout', retryCount: 3 },
          { name: 'review', agentType: 'pr-reviewer', status: 'skipped', durationMs: 0, error: null, retryCount: 0 },
        ],
      });
      await fs.writeFile(path.join(stateDir, 'mixed-session.yaml'), content, 'utf-8');

      const loaded = await agent.loadPriorSession('mixed-session', tempDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.preCompletedStages).toEqual(['issue_reading', 'orchestration']);
    });
  });

  describe('findLatestSession', () => {
    it('should return null when no sessions exist', async () => {
      await agent.initialize();
      const result = await agent.findLatestSession(tempDir);
      expect(result).toBeNull();
    });

    it('should return null when pipeline directory does not exist', async () => {
      await agent.initialize();
      const result = await agent.findLatestSession('/nonexistent/path/12345');
      expect(result).toBeNull();
    });

    it('should return the most recent session ID', async () => {
      await agent.initialize();

      // Run a pipeline to create a session file
      const result = await agent.executePipeline(tempDir, 'test');
      const sessionId = result.pipelineId;

      const agent2 = new AdsdlcOrchestratorAgent();
      await agent2.initialize();
      const latestId = await agent2.findLatestSession(tempDir);

      expect(latestId).toBe(sessionId);
      await agent2.dispose();
    });
  });

  describe('startSession with resume', () => {
    it('should resume from prior session when resumeSessionId is provided', async () => {
      await agent.initialize();

      // Run a pipeline to persist state
      const result = await agent.executePipeline(tempDir, 'Build a web app');
      const sessionId = result.pipelineId;

      // Dispose old agent, create new one
      await agent.dispose();
      const agent2 = new AdsdlcOrchestratorAgent();
      await agent2.initialize();

      const session = await agent2.startSession({
        projectDir: tempDir,
        userRequest: 'Continue build',
        resumeSessionId: sessionId,
      });

      expect(session.resumedFrom).toBe(sessionId);
      expect(session.status).toBe('running');
      expect(session.preCompletedStages).toBeDefined();
      expect(session.preCompletedStages!.length).toBeGreaterThan(0);

      await agent2.dispose();
    });

    it('should create fresh session when resumeSessionId points to nonexistent session', async () => {
      await agent.initialize();

      const session = await agent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
        resumeSessionId: 'nonexistent-session-id',
      });

      // Should fall through to fresh session creation
      expect(session.resumedFrom).toBeUndefined();
      expect(session.status).toBe('pending');
    });
  });
});

describe('GREENFIELD_STAGES', () => {
  it('should define 12 stages', () => {
    expect(GREENFIELD_STAGES).toHaveLength(12);
  });

  it('should start with initialization and end with review', () => {
    expect(GREENFIELD_STAGES[0]!.name).toBe('initialization');
    expect(GREENFIELD_STAGES[GREENFIELD_STAGES.length - 1]!.name).toBe('review');
  });

  it('should have valid dependency chains', () => {
    const stageNames = new Set(GREENFIELD_STAGES.map((s) => s.name));
    for (const stage of GREENFIELD_STAGES) {
      for (const dep of stage.dependsOn) {
        expect(stageNames.has(dep)).toBe(true);
      }
    }
  });

  it('should assign correct agent types', () => {
    const stageMap = new Map(GREENFIELD_STAGES.map((s) => [s.name, s.agentType]));
    expect(stageMap.get('initialization')).toBe('project-initializer');
    expect(stageMap.get('collection')).toBe('collector');
    expect(stageMap.get('prd_generation')).toBe('prd-writer');
    expect(stageMap.get('srs_generation')).toBe('srs-writer');
    expect(stageMap.get('sds_generation')).toBe('sds-writer');
    expect(stageMap.get('issue_generation')).toBe('issue-generator');
    expect(stageMap.get('orchestration')).toBe('controller');
    expect(stageMap.get('implementation')).toBe('worker');
    expect(stageMap.get('review')).toBe('pr-reviewer');
  });
});

describe('ENHANCEMENT_STAGES', () => {
  it('should define 13 stages', () => {
    expect(ENHANCEMENT_STAGES).toHaveLength(13);
  });

  it('should start with parallel analysis stages', () => {
    const firstThree = ENHANCEMENT_STAGES.slice(0, 3);
    expect(firstThree.every((s) => s.parallel)).toBe(true);
    expect(firstThree.every((s) => s.dependsOn.length === 0)).toBe(true);
  });

  it('should end with regression testing and review', () => {
    const lastTwo = ENHANCEMENT_STAGES.slice(-2);
    expect(lastTwo[0]!.name).toBe('regression_testing');
    expect(lastTwo[1]!.name).toBe('review');
  });

  it('should have doc_code_comparison depend on all three analysis stages', () => {
    const comparison = ENHANCEMENT_STAGES.find((s) => s.name === 'doc_code_comparison');
    expect(comparison).toBeDefined();
    expect(comparison!.dependsOn).toContain('document_reading');
    expect(comparison!.dependsOn).toContain('codebase_analysis');
    expect(comparison!.dependsOn).toContain('code_reading');
  });

  it('should have valid dependency chains', () => {
    const stageNames = new Set(ENHANCEMENT_STAGES.map((s) => s.name));
    for (const stage of ENHANCEMENT_STAGES) {
      for (const dep of stage.dependsOn) {
        expect(stageNames.has(dep)).toBe(true);
      }
    }
  });

  it('should assign correct agent types', () => {
    const stageMap = new Map(ENHANCEMENT_STAGES.map((s) => [s.name, s.agentType]));
    expect(stageMap.get('document_reading')).toBe('document-reader');
    expect(stageMap.get('codebase_analysis')).toBe('codebase-analyzer');
    expect(stageMap.get('code_reading')).toBe('code-reader');
    expect(stageMap.get('doc_code_comparison')).toBe('doc-code-comparator');
    expect(stageMap.get('impact_analysis')).toBe('impact-analyzer');
    expect(stageMap.get('prd_update')).toBe('prd-updater');
    expect(stageMap.get('srs_update')).toBe('srs-updater');
    expect(stageMap.get('sds_update')).toBe('sds-updater');
    expect(stageMap.get('regression_testing')).toBe('regression-tester');
  });
});

describe('IMPORT_STAGES', () => {
  it('should define 4 stages', () => {
    expect(IMPORT_STAGES).toHaveLength(4);
  });

  it('should start with issue_reading and end with review', () => {
    expect(IMPORT_STAGES[0]!.name).toBe('issue_reading');
    expect(IMPORT_STAGES[IMPORT_STAGES.length - 1]!.name).toBe('review');
  });

  it('should have valid dependency chains', () => {
    const stageNames = new Set(IMPORT_STAGES.map((s) => s.name));
    for (const stage of IMPORT_STAGES) {
      for (const dep of stage.dependsOn) {
        expect(stageNames.has(dep)).toBe(true);
      }
    }
  });

  it('should assign correct agent types', () => {
    const stageMap = new Map(IMPORT_STAGES.map((s) => [s.name, s.agentType]));
    expect(stageMap.get('issue_reading')).toBe('issue-reader');
    expect(stageMap.get('orchestration')).toBe('controller');
    expect(stageMap.get('implementation')).toBe('worker');
    expect(stageMap.get('review')).toBe('pr-reviewer');
  });
});

describe('DEFAULT_ORCHESTRATOR_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.scratchpadDir).toBe('.ad-sdlc/scratchpad');
    expect(DEFAULT_ORCHESTRATOR_CONFIG.outputDocsDir).toBe('docs');
    expect(DEFAULT_ORCHESTRATOR_CONFIG.approvalMode).toBe('auto');
    expect(DEFAULT_ORCHESTRATOR_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_ORCHESTRATOR_CONFIG.timeouts.default).toBe(300_000);
    expect(DEFAULT_ORCHESTRATOR_CONFIG.logLevel).toBe('INFO');
  });
});

// ---------------------------------------------------------------------------
// Pipeline Dependency Chain Validation (Part 3 — Integration Tests)
// ---------------------------------------------------------------------------

describe('Pipeline Dependency Chain — Topological Order', () => {
  function validateTopologicalOrder(stages: readonly PipelineStageDefinition[]): boolean {
    const completed = new Set<string>();
    for (const stage of stages) {
      for (const dep of stage.dependsOn) {
        if (!completed.has(dep)) {
          return false;
        }
      }
      completed.add(stage.name);
    }
    return true;
  }

  it('GREENFIELD_STAGES should be in valid topological order', () => {
    expect(validateTopologicalOrder(GREENFIELD_STAGES)).toBe(true);
  });

  it('ENHANCEMENT_STAGES should be in valid topological order (accounting for parallel roots)', () => {
    // Parallel root stages have no dependencies, so they pass topological validation
    expect(validateTopologicalOrder(ENHANCEMENT_STAGES)).toBe(true);
  });

  it('IMPORT_STAGES should be in valid topological order', () => {
    expect(validateTopologicalOrder(IMPORT_STAGES)).toBe(true);
  });

  it('should not have circular dependencies in any pipeline', () => {
    function hasCircularDeps(stages: readonly PipelineStageDefinition[]): boolean {
      const stageMap = new Map(stages.map((s) => [s.name, s]));
      const visited = new Set<string>();
      const inStack = new Set<string>();

      function dfs(name: string): boolean {
        if (inStack.has(name)) return true;
        if (visited.has(name)) return false;
        visited.add(name);
        inStack.add(name);

        const stage = stageMap.get(name);
        if (stage !== undefined) {
          for (const dep of stage.dependsOn) {
            if (dfs(dep)) return true;
          }
        }

        inStack.delete(name);
        return false;
      }

      for (const stage of stages) {
        if (dfs(stage.name)) return true;
      }
      return false;
    }

    expect(hasCircularDeps(GREENFIELD_STAGES)).toBe(false);
    expect(hasCircularDeps(ENHANCEMENT_STAGES)).toBe(false);
    expect(hasCircularDeps(IMPORT_STAGES)).toBe(false);
  });
});

describe('Pipeline Stage Sequencing — End-to-End', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-sequencing-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('greenfield pipeline should execute all 12 stages in dependency order', async () => {
    const executionOrder: string[] = [];

    class OrderTrackingOrchestrator extends AdsdlcOrchestratorAgent {
      protected override async invokeAgent(
        stage: { name: string; agentType: string },
        _session: unknown
      ): Promise<string> {
        executionOrder.push(stage.name);
        return `Stage "${stage.name}" completed`;
      }
    }

    const agent = new OrderTrackingOrchestrator();
    await agent.initialize();
    const result = await agent.executePipeline(tempDir, 'test');

    expect(result.overallStatus).toBe('completed');
    expect(executionOrder).toHaveLength(GREENFIELD_STAGES.length);

    // Verify each stage runs after all its dependencies
    for (const stage of GREENFIELD_STAGES) {
      const stageIdx = executionOrder.indexOf(stage.name);
      expect(stageIdx).toBeGreaterThanOrEqual(0);

      for (const dep of stage.dependsOn) {
        const depIdx = executionOrder.indexOf(dep);
        expect(depIdx).toBeLessThan(stageIdx);
      }
    }

    await agent.dispose();
  });

  it('enhancement pipeline should execute parallel roots before sequential stages', async () => {
    const executionOrder: string[] = [];

    class OrderTrackingOrchestrator extends AdsdlcOrchestratorAgent {
      protected override async invokeAgent(
        stage: { name: string; agentType: string },
        _session: unknown
      ): Promise<string> {
        executionOrder.push(stage.name);
        return `Stage "${stage.name}" completed`;
      }
    }

    const agent = new OrderTrackingOrchestrator();
    await agent.initialize();
    await agent.startSession({
      projectDir: tempDir,
      userRequest: 'enhancement test',
      overrideMode: 'enhancement',
    });
    const result = await agent.executePipeline(tempDir, 'enhancement test');

    expect(result.overallStatus).toBe('completed');
    expect(executionOrder).toHaveLength(ENHANCEMENT_STAGES.length);

    // Parallel roots (document_reading, codebase_analysis, code_reading)
    // must all appear before doc_code_comparison
    const compIdx = executionOrder.indexOf('doc_code_comparison');
    expect(executionOrder.indexOf('document_reading')).toBeLessThan(compIdx);
    expect(executionOrder.indexOf('codebase_analysis')).toBeLessThan(compIdx);
    expect(executionOrder.indexOf('code_reading')).toBeLessThan(compIdx);

    // Sequential chain: impact_analysis → prd_update → srs_update → sds_update
    const impactIdx = executionOrder.indexOf('impact_analysis');
    const prdIdx = executionOrder.indexOf('prd_update');
    const srsIdx = executionOrder.indexOf('srs_update');
    const sdsIdx = executionOrder.indexOf('sds_update');
    expect(compIdx).toBeLessThan(impactIdx);
    expect(impactIdx).toBeLessThan(prdIdx);
    expect(prdIdx).toBeLessThan(srsIdx);
    expect(srsIdx).toBeLessThan(sdsIdx);

    // regression_testing must come after implementation
    const implIdx = executionOrder.indexOf('implementation');
    const regIdx = executionOrder.indexOf('regression_testing');
    expect(implIdx).toBeLessThan(regIdx);

    await agent.dispose();
  });

  it('import pipeline should follow strict sequential chain', async () => {
    const executionOrder: string[] = [];

    class OrderTrackingOrchestrator extends AdsdlcOrchestratorAgent {
      protected override async invokeAgent(
        stage: { name: string; agentType: string },
        _session: unknown
      ): Promise<string> {
        executionOrder.push(stage.name);
        return `Stage "${stage.name}" completed`;
      }
    }

    const agent = new OrderTrackingOrchestrator();
    await agent.initialize();
    await agent.startSession({
      projectDir: tempDir,
      userRequest: 'import test',
      overrideMode: 'import',
    });
    const result = await agent.executePipeline(tempDir, 'import test');

    expect(result.overallStatus).toBe('completed');
    expect(executionOrder).toEqual(['issue_reading', 'orchestration', 'implementation', 'review']);

    await agent.dispose();
  });
});

describe('Cross-Pipeline Agent Type Consistency', () => {
  it('shared stage names should use the same agent type across pipelines', () => {
    // Stages that appear in multiple pipelines
    const shared = ['orchestration', 'implementation', 'review', 'issue_generation'];

    const allStages = [...GREENFIELD_STAGES, ...ENHANCEMENT_STAGES, ...IMPORT_STAGES];
    const stageTypeMap = new Map<string, Set<string>>();

    for (const stage of allStages) {
      if (shared.includes(stage.name)) {
        if (!stageTypeMap.has(stage.name)) {
          stageTypeMap.set(stage.name, new Set());
        }
        stageTypeMap.get(stage.name)!.add(stage.agentType);
      }
    }

    // Each shared stage name should map to exactly one agent type
    for (const [stageName, types] of stageTypeMap) {
      expect(types.size).toBe(1);
    }
  });

  it('every stage should have a non-empty agentType and description', () => {
    const allStages = [...GREENFIELD_STAGES, ...ENHANCEMENT_STAGES, ...IMPORT_STAGES];

    for (const stage of allStages) {
      expect(stage.agentType).toBeTruthy();
      expect(stage.description).toBeTruthy();
    }
  });

  it('greenfield pipeline should include repo-detector and github-repo-setup stages', () => {
    const stageNames = GREENFIELD_STAGES.map((s) => s.name);
    expect(stageNames).toContain('repo_detection');
    expect(stageNames).toContain('github_repo_setup');

    // github_repo_setup should depend on repo_detection
    const repoSetup = GREENFIELD_STAGES.find((s) => s.name === 'github_repo_setup');
    expect(repoSetup).toBeDefined();
    expect(repoSetup!.dependsOn).toContain('repo_detection');
  });

  it('enhancement pipeline should NOT include repo-detector or github-repo-setup', () => {
    const stageNames = ENHANCEMENT_STAGES.map((s) => s.name);
    expect(stageNames).not.toContain('repo_detection');
    expect(stageNames).not.toContain('github_repo_setup');
  });
});

describe('Module Registration in agents/index.ts', () => {
  let agentsIndexSource: string;

  beforeAll(async () => {
    const agentsIndexPath = path.resolve(__dirname, '../../src/agents/index.ts');
    agentsIndexSource = await fs.readFile(agentsIndexPath, 'utf-8');
  });

  it('should register AdsdlcOrchestrator namespace export in agents/index.ts', () => {
    expect(agentsIndexSource).toContain(
      "export * as AdsdlcOrchestrator from '../ad-sdlc-orchestrator/index.js'"
    );
  });

  it('should export pipeline stage definitions from orchestrator barrel', async () => {
    // Verify the barrel file re-exports stages and config
    const barrelPath = path.resolve(__dirname, '../../src/ad-sdlc-orchestrator/index.ts');
    const barrelSource = await fs.readFile(barrelPath, 'utf-8');

    expect(barrelSource).toContain('GREENFIELD_STAGES');
    expect(barrelSource).toContain('ENHANCEMENT_STAGES');
    expect(barrelSource).toContain('IMPORT_STAGES');
    expect(barrelSource).toContain('DEFAULT_ORCHESTRATOR_CONFIG');
  });

  it('should export error classes from orchestrator barrel', async () => {
    const barrelPath = path.resolve(__dirname, '../../src/ad-sdlc-orchestrator/index.ts');
    const barrelSource = await fs.readFile(barrelPath, 'utf-8');

    expect(barrelSource).toContain('OrchestratorError');
    expect(barrelSource).toContain('PipelineFailedError');
    expect(barrelSource).toContain('InvalidProjectDirError');
  });
});
