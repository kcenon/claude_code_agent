/**
 * Worker-pilot integration tests (issue #793)
 *
 * Verifies that the orchestrator's `invokeAgent` correctly routes the
 * `worker` stage based on the `AD_SDLC_USE_SDK_FOR_WORKER` environment
 * flag:
 *
 * - Flag unset / not `'1'`  → AgentBridge path (`executeViaBridge`)
 * - Flag `'1'`               → ExecutionAdapter path (`executeViaAdapter`)
 *
 * Equivalence is asserted against the *artifact set* both paths produce.
 * For this issue the comparison is intentionally narrow (one synthetic
 * scenario); issue #794 will expand the suite to five scenarios using
 * the same {@link assertEquivalentArtifacts} helper exported here.
 *
 * The acceptance criteria mapping:
 *   AC-1  Flag on  → adapter path is used.        Covered by `routes worker via adapter when flag is on`.
 *   AC-2  Flag off → bridge path is used (regression 0).   Covered by `routes worker via bridge when flag is off`.
 *   AC-3  Equivalent artifacts.                    Covered by `produces equivalent artifacts on both paths`.
 *   AC-4  Runtime within ±20%.                     Out of scope for unit-level integration; documented in PR.
 *   AC-5  tokenUsage populated.                    Covered by `populates tokenUsage in adapter result`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AdsdlcOrchestratorAgent,
  WORKER_PILOT_ENV_FLAG,
} from '../../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import type {
  OrchestratorSession,
  PipelineStageDefinition,
} from '../../../src/ad-sdlc-orchestrator/types.js';
import { MockExecutionAdapter } from '../../../src/execution/MockExecutionAdapter.js';
import type {
  ArtifactRef,
  ExecutionAdapter,
  StageExecutionRequest,
  StageExecutionResult,
} from '../../../src/execution/types.js';

/**
 * Test subclass exposing protected hooks and recording bridge calls so
 * the test can prove the routing decision without monkey-patching.
 */
class TestOrchestrator extends AdsdlcOrchestratorAgent {
  bridgeCalls: PipelineStageDefinition[] = [];
  adapterCalls: PipelineStageDefinition[] = [];
  bridgeArtifacts: readonly string[] = [];
  injectedAdapter: MockExecutionAdapter | null = null;

  override async invokeAgent(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<string> {
    return super.invokeAgent(stage, session);
  }

  protected override async executeViaBridge(
    stage: PipelineStageDefinition,
    _session: OrchestratorSession
  ): Promise<string> {
    this.bridgeCalls.push(stage);
    // Simulate a worker AgentBridge that produced two artifacts.
    return JSON.stringify({
      stage: 'worker',
      via: 'agent-bridge',
      artifacts: [...this.bridgeArtifacts],
    });
  }

  protected override async executeViaAdapter(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<string> {
    this.adapterCalls.push(stage);
    return super.executeViaAdapter(stage, session);
  }

  protected override createExecutionAdapter(_session: OrchestratorSession): ExecutionAdapter {
    if (!this.injectedAdapter) {
      throw new Error('TestOrchestrator: injectedAdapter must be set before adapter path runs');
    }
    return this.injectedAdapter;
  }

  setInjectedAdapter(adapter: MockExecutionAdapter): void {
    this.injectedAdapter = adapter;
  }
}

/**
 * Build a minimal worker stage definition.
 */
function workerStage(): PipelineStageDefinition {
  return {
    name: 'worker',
    agentType: 'worker',
    description: 'Worker stage under pilot',
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
  };
}

/**
 * Build a minimal session for the worker stage.
 */
function buildSession(overrides: Partial<OrchestratorSession> = {}): OrchestratorSession {
  return {
    sessionId: 'test-session-793',
    projectDir: '/tmp/worker-pilot-test',
    userRequest: 'Implement the function described by issue #793',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: '/tmp/worker-pilot-test/.ad-sdlc/scratchpad',
    localMode: true,
    ...overrides,
  };
}

/**
 * Compare two artifact lists for set equality on the `path` field. Order
 * is intentionally ignored — the worker may emit files in different
 * orders across runs, which is expected.
 *
 * Exposed so issue #794 can reuse it across the wider scenario matrix.
 */
export function assertEquivalentArtifacts(
  a: readonly { path: string }[],
  b: readonly { path: string }[]
): void {
  const sortedA = [...a].map((x) => x.path).sort();
  const sortedB = [...b].map((x) => x.path).sort();
  expect(sortedA).toEqual(sortedB);
}

/**
 * Parse the JSON output produced by either path into a compact summary
 * the test can assert against.
 */
function parseStageOutput(output: string): {
  via: string;
  artifacts: readonly { path: string; description?: string }[];
  tokenUsage?: { input: number; output: number; cache: number };
} {
  const parsed = JSON.parse(output) as {
    via: string;
    artifacts?: readonly { path: string; description?: string }[];
    tokenUsage?: { input: number; output: number; cache: number };
  };
  return {
    via: parsed.via,
    artifacts: parsed.artifacts ?? [],
    ...(parsed.tokenUsage !== undefined ? { tokenUsage: parsed.tokenUsage } : {}),
  };
}

describe('worker-pilot integration (#793)', () => {
  let originalFlag: string | undefined;
  let agent: TestOrchestrator;

  beforeEach(() => {
    originalFlag = process.env[WORKER_PILOT_ENV_FLAG];
    delete process.env[WORKER_PILOT_ENV_FLAG];
    agent = new TestOrchestrator();
  });

  afterEach(async () => {
    if (originalFlag === undefined) {
      delete process.env[WORKER_PILOT_ENV_FLAG];
    } else {
      process.env[WORKER_PILOT_ENV_FLAG] = originalFlag;
    }
    await agent.dispose().catch(() => {
      // tolerate dispose errors in cleanup
    });
  });

  describe('AC-2: regression-zero when flag is unset (default)', () => {
    it('routes worker via bridge when flag is unset', async () => {
      // Flag unset → bridge path
      agent.bridgeArtifacts = ['src/index.ts', 'package.json'];
      const stage = workerStage();
      const session = buildSession();

      const output = await agent.invokeAgent(stage, session);
      const parsedRaw = JSON.parse(output) as {
        via: string;
        artifacts: readonly string[];
      };

      expect(parsedRaw.via).toBe('agent-bridge');
      expect(agent.bridgeCalls).toHaveLength(1);
      expect(agent.adapterCalls).toHaveLength(0);
      expect([...parsedRaw.artifacts].sort()).toEqual(['package.json', 'src/index.ts']);
    });

    it('routes worker via bridge when flag is set to a non-1 value', async () => {
      process.env[WORKER_PILOT_ENV_FLAG] = '0';
      const output = await agent.invokeAgent(workerStage(), buildSession());
      expect(parseStageOutput(output).via).toBe('agent-bridge');
      expect(agent.adapterCalls).toHaveLength(0);
    });

    it('does not route non-worker stages via the adapter even when flag is on', async () => {
      process.env[WORKER_PILOT_ENV_FLAG] = '1';
      const stage: PipelineStageDefinition = {
        ...workerStage(),
        name: 'controller',
        agentType: 'controller',
      };
      const output = await agent.invokeAgent(stage, buildSession());
      expect(parseStageOutput(output).via).toBe('agent-bridge');
      expect(agent.adapterCalls).toHaveLength(0);
    });
  });

  describe('AC-1: adapter path is used when flag is on', () => {
    it('routes worker via adapter when flag is on', async () => {
      process.env[WORKER_PILOT_ENV_FLAG] = '1';

      const adapter = new MockExecutionAdapter({
        defaultResult: {
          status: 'success',
          artifacts: [
            { path: 'src/index.ts', description: 'worker scaffold entrypoint' },
            { path: 'package.json', description: 'worker scaffold manifest' },
          ],
          sessionId: 'sdk-session-001',
          toolCallCount: 2,
          tokenUsage: { input: 1234, output: 567, cache: 0 },
        },
      });
      agent.setInjectedAdapter(adapter);

      const output = await agent.invokeAgent(workerStage(), buildSession());
      const parsed = parseStageOutput(output);

      expect(parsed.via).toBe('execution-adapter');
      expect(agent.adapterCalls).toHaveLength(1);
      expect(agent.bridgeCalls).toHaveLength(0);
      expect(adapter.calls).toHaveLength(1);

      const req = adapter.calls[0] as StageExecutionRequest;
      expect(req.agentType).toBe('worker');
      // Issue requirement: workOrder must be the user request verbatim
      expect(req.workOrder).toBe('Implement the function described by issue #793');
      // Empty priorOutputs since stageResults is empty in this scenario
      expect(req.priorOutputs).toEqual({});
    });

    it('forwards completed prior-stage outputs into priorOutputs', async () => {
      process.env[WORKER_PILOT_ENV_FLAG] = '1';

      const adapter = new MockExecutionAdapter();
      agent.setInjectedAdapter(adapter);

      const session = buildSession({
        stageResults: [
          {
            name: 'controller',
            agentType: 'controller',
            status: 'completed',
            durationMs: 10,
            output: 'controller-output-payload',
            artifacts: [],
            error: null,
            retryCount: 0,
          },
          {
            name: 'collection',
            agentType: 'collector',
            status: 'failed',
            durationMs: 5,
            output: 'should-not-be-included',
            artifacts: [],
            error: 'boom',
            retryCount: 1,
          },
        ],
      });

      await agent.invokeAgent(workerStage(), session);

      expect(adapter.calls).toHaveLength(1);
      const req = adapter.calls[0] as StageExecutionRequest;
      // Only completed stages are forwarded
      expect(req.priorOutputs).toEqual({
        controller: 'controller-output-payload',
      });
    });
  });

  describe('AC-5: tokenUsage and observability', () => {
    it('populates tokenUsage in adapter result', async () => {
      process.env[WORKER_PILOT_ENV_FLAG] = '1';

      const adapter = new MockExecutionAdapter({
        defaultResult: {
          status: 'success',
          artifacts: [],
          sessionId: 'sdk-token-test',
          toolCallCount: 0,
          tokenUsage: { input: 999, output: 111, cache: 22 },
        },
      });
      agent.setInjectedAdapter(adapter);

      const output = await agent.invokeAgent(workerStage(), buildSession());
      const parsed = parseStageOutput(output);

      expect(parsed.tokenUsage).toEqual({ input: 999, output: 111, cache: 22 });
    });

    it('throws when the adapter reports a non-success status', async () => {
      process.env[WORKER_PILOT_ENV_FLAG] = '1';

      const { ErrorSeverity } = await import('../../../src/errors/types.js');
      const failingResult: StageExecutionResult = {
        status: 'failed',
        artifacts: [],
        sessionId: 'sdk-fail',
        toolCallCount: 0,
        tokenUsage: { input: 0, output: 0, cache: 0 },
        error: {
          code: 'EXEC-003',
          message: 'simulated SDK failure',
          severity: ErrorSeverity.HIGH,
          context: {},
          timestamp: new Date().toISOString(),
        },
      };
      const adapter = new MockExecutionAdapter({ defaultResult: failingResult });
      agent.setInjectedAdapter(adapter);

      await expect(agent.invokeAgent(workerStage(), buildSession())).rejects.toThrow(
        /Worker-pilot ExecutionAdapter failed/
      );
    });
  });

  describe('AC-3: artifact equivalence between paths', () => {
    it('produces equivalent artifacts on both paths', async () => {
      // 1) Bridge path artifacts
      agent.bridgeArtifacts = ['src/index.ts', 'package.json'];
      const bridgeOutput = await agent.invokeAgent(workerStage(), buildSession());
      const bridgeParsed = parseStageOutput(bridgeOutput);
      expect(bridgeParsed.via).toBe('agent-bridge');

      // 2) Adapter path artifacts — same files, possibly different order
      process.env[WORKER_PILOT_ENV_FLAG] = '1';
      const adapter = new MockExecutionAdapter({
        defaultResult: {
          status: 'success',
          artifacts: [
            { path: 'package.json' },
            { path: 'src/index.ts' },
          ] satisfies readonly ArtifactRef[],
          sessionId: 'sdk-equiv',
          toolCallCount: 1,
          tokenUsage: { input: 0, output: 0, cache: 0 },
        },
      });
      agent.setInjectedAdapter(adapter);
      const adapterOutput = await agent.invokeAgent(workerStage(), buildSession());
      const adapterParsed = parseStageOutput(adapterOutput);
      expect(adapterParsed.via).toBe('execution-adapter');

      // Both paths emit the same artifact set
      const bridgeArtifacts = bridgeParsed.artifacts.map((p) =>
        typeof p === 'string' ? { path: p } : p
      );
      assertEquivalentArtifacts(bridgeArtifacts, adapterParsed.artifacts);
    });
  });
});
