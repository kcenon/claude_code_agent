/**
 * Shared helpers for worker-pilot integration tests (issue #794).
 *
 * The original {@link assertEquivalentArtifacts} helper was introduced in
 * issue #793 inside `worker-pilot.integration.test.ts`. Issue #794 broadens
 * the equivalence matrix to five scenarios (`simple-bug-fix`, `new-feature`,
 * `refactor`, `with-deps-conflict`, `large-issue`); to keep a single source
 * of truth across all six test files we extracted the helper here and
 * re-export it from the original test file for backwards compatibility.
 *
 * Tests that need to compare a `MockExecutionAdapter` run against an
 * `SdkExecutionAdapter` run should:
 *
 *   1. Build a {@link TestOrchestrator} via {@link createTestOrchestrator}.
 *   2. Invoke the worker stage on each path (bridge / adapter).
 *   3. Parse outputs with {@link parseStageOutput}.
 *   4. Compare with {@link assertEquivalentArtifacts}.
 *
 * The helper deliberately compares the *set* of artifact paths, not their
 * order, because the worker may emit files in different orders across
 * adapter runs and equivalence is at the file-set level.
 *
 * @packageDocumentation
 */

import { expect } from 'vitest';

import {
  AdsdlcOrchestratorAgent,
  WORKER_PILOT_ENV_FLAG,
} from '../../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import type {
  OrchestratorSession,
  PipelineStageDefinition,
} from '../../../src/ad-sdlc-orchestrator/types.js';
import type { MockExecutionAdapter } from '../../../src/execution/MockExecutionAdapter.js';
import type { ExecutionAdapter } from '../../../src/execution/types.js';

export { WORKER_PILOT_ENV_FLAG };

/**
 * Test subclass exposing protected hooks so scenario files can prove which
 * path executed and inject a {@link MockExecutionAdapter} for the SDK arm.
 *
 * The `bridgeArtifacts` field configures the simulated artifact list the
 * bridge path emits. The `injectedAdapter` field is consulted whenever the
 * orchestrator calls {@link createExecutionAdapter}; tests must set it via
 * {@link TestOrchestrator.setInjectedAdapter} before exercising the adapter
 * arm or the call will throw.
 */
export class TestOrchestrator extends AdsdlcOrchestratorAgent {
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
export function workerStage(
  overrides: Partial<PipelineStageDefinition> = {}
): PipelineStageDefinition {
  return {
    name: 'worker' as PipelineStageDefinition['name'],
    agentType: 'worker',
    description: 'Worker stage under pilot',
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
    ...overrides,
  };
}

/**
 * Build a minimal session for the worker stage.
 *
 * Tests that need prior-stage outputs (T4 / `with-deps-conflict`) supply
 * `stageResults` via overrides.
 */
export function buildSession(overrides: Partial<OrchestratorSession> = {}): OrchestratorSession {
  return {
    sessionId: 'test-session-794',
    projectDir: '/tmp/worker-pilot-test',
    userRequest: 'Implement the worker stage as described',
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
 * Used by every scenario file in this directory plus the original
 * `worker-pilot.integration.test.ts` (which re-exports it).
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
export function parseStageOutput(output: string): {
  via: string;
  artifacts: readonly { path: string; description?: string }[];
  tokenUsage?: { input: number; output: number; cache: number };
  toolCallCount?: number;
} {
  const parsed = JSON.parse(output) as {
    via: string;
    artifacts?: readonly ({ path: string; description?: string } | string)[];
    tokenUsage?: { input: number; output: number; cache: number };
    toolCallCount?: number;
  };
  const artifacts = (parsed.artifacts ?? []).map((entry) =>
    typeof entry === 'string' ? { path: entry } : entry
  );
  return {
    via: parsed.via,
    artifacts,
    ...(parsed.tokenUsage !== undefined ? { tokenUsage: parsed.tokenUsage } : {}),
    ...(parsed.toolCallCount !== undefined ? { toolCallCount: parsed.toolCallCount } : {}),
  };
}

/**
 * Whether the optional real-adapter arm should run. Returns false unless
 * `ANTHROPIC_API_KEY` is set, gating any live SDK call out of CI runs that
 * lack credentials. Scenario files use `test.skipIf(!shouldRunRealAdapter())`
 * to skip the live arm without polluting the report.
 *
 * The mock-vs-mock equivalence arm always runs because it does not hit the
 * network.
 */
export function shouldRunRealAdapter(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === 'string' && key.length > 0;
}

/**
 * Save / restore the `AD_SDLC_USE_SDK_FOR_WORKER` environment flag around
 * a test. Returns a cleanup function the test must call in `afterEach`.
 */
export function preserveWorkerPilotFlag(): () => void {
  const original = process.env[WORKER_PILOT_ENV_FLAG];
  return (): void => {
    if (original === undefined) {
      delete process.env[WORKER_PILOT_ENV_FLAG];
    } else {
      process.env[WORKER_PILOT_ENV_FLAG] = original;
    }
  };
}

/**
 * Construct a fresh {@link TestOrchestrator}. Centralised so scenario files
 * stay focused on their own arrange / act / assert flow.
 */
export function createTestOrchestrator(): TestOrchestrator {
  return new TestOrchestrator();
}
