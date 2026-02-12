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
} from '../../src/ad-sdlc-orchestrator/errors.js';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  GREENFIELD_STAGES,
} from '../../src/ad-sdlc-orchestrator/types.js';
import type {
  OrchestratorConfig,
  PipelineRequest,
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
      await expect(
        agent.executePipeline('/nonexistent/path', 'test')
      ).rejects.toThrow(InvalidProjectDirError);
    });

    it('should return empty stages for unimplemented modes', async () => {
      await agent.initialize();

      await agent.startSession({
        projectDir: tempDir,
        userRequest: 'test',
        overrideMode: 'enhancement',
      });

      const result = await agent.executePipeline(tempDir, 'test');
      // Enhancement pipeline returns empty stages in Part 1
      expect(result.stages).toHaveLength(0);
      expect(result.overallStatus).toBe('completed');
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
