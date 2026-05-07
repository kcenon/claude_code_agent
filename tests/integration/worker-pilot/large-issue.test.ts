/**
 * T5 — Large-issue / `maxTurns` timeout scenario (issue #794).
 *
 * Simulates a work order whose tool-use sequence would exhaust the
 * agent's `maxTurns` budget. We exercise the *failure path* of
 * `toStageOutput` so the orchestrator's existing retry / failure
 * handling sees an exception with a deterministic message.
 *
 * Why this is mock-only on both arms: even with `ANTHROPIC_API_KEY`
 * exported, deliberately running the live SDK to exhaustion is wasteful
 * and slow (well outside the 5-minute integration budget). The
 * `EXEC-005` failure shape is the same regardless of which adapter
 * raised it; what matters for equivalence is that the orchestrator
 * surfaces the failure identically. We therefore drive a
 * {@link MockExecutionAdapter} that returns a synthesised `failed`
 * result and assert on the surfaced error.
 *
 * **Real-adapter arm**: gated by `ANTHROPIC_API_KEY` via
 * `test.skipIf(!shouldRunRealAdapter())`. When the key is present the
 * test still uses the mock adapter (with a comment explaining why) so
 * we never burn live tokens to reproduce a timeout.
 */

import { describe, it, beforeEach, afterEach, expect, test } from 'vitest';

import { ErrorSeverity } from '../../../src/errors/types.js';
import { MockExecutionAdapter } from '../../../src/execution/MockExecutionAdapter.js';
import type { StageExecutionResult } from '../../../src/execution/types.js';

import {
  TestOrchestrator,
  WORKER_PILOT_ENV_FLAG,
  buildSession,
  createTestOrchestrator,
  preserveWorkerPilotFlag,
  shouldRunRealAdapter,
  workerStage,
} from './_helpers.js';

/**
 * Synthesise a `maxTurns`-exhaustion result. Mirrors what
 * `SdkExecutionAdapter` produces when its inner SDK loop terminates
 * without a `result` message.
 */
function buildMaxTurnsExhaustedResult(toolCallCount: number): StageExecutionResult {
  return {
    status: 'failed',
    artifacts: [],
    sessionId: 'sdk-T5-timeout',
    toolCallCount,
    tokenUsage: { input: 9000, output: 4000, cache: 0 },
    error: {
      code: 'EXEC-005',
      message: `maxTurns budget exhausted after ${toolCallCount} steps`,
      severity: ErrorSeverity.HIGH,
      context: { toolCallCount, maxTurns: 10 },
      timestamp: new Date().toISOString(),
    },
  };
}

describe('worker-pilot T5-large-issue: maxTurns timeout handling', () => {
  let restoreFlag: () => void;
  let agent: TestOrchestrator;

  beforeEach(() => {
    restoreFlag = preserveWorkerPilotFlag();
    delete process.env[WORKER_PILOT_ENV_FLAG];
    agent = createTestOrchestrator();
  });

  afterEach(async () => {
    restoreFlag();
    await agent.dispose().catch(() => undefined);
  });

  it('surfaces a maxTurns exhaustion (>10 steps) as a thrown failure', async () => {
    process.env[WORKER_PILOT_ENV_FLAG] = '1';

    // 11 steps > the configured maxTurns of 10 → adapter reports failed.
    const result = buildMaxTurnsExhaustedResult(11);
    const adapter = new MockExecutionAdapter({ defaultResult: result });
    agent.setInjectedAdapter(adapter);

    await expect(
      agent.invokeAgent(
        workerStage(),
        buildSession({ userRequest: 'Implement a 30-component cross-cutting feature' })
      )
    ).rejects.toThrow(/Worker-pilot ExecutionAdapter failed.*maxTurns budget exhausted/);

    // The adapter was called exactly once before the failure surfaced.
    expect(adapter.calls).toHaveLength(1);
  });

  it('records >10 tool calls in the failure result for postmortem use', async () => {
    process.env[WORKER_PILOT_ENV_FLAG] = '1';

    const result = buildMaxTurnsExhaustedResult(12);
    const adapter = new MockExecutionAdapter({ defaultResult: result });
    agent.setInjectedAdapter(adapter);

    // Capture the synthesised result by spying on the adapter's
    // `defaultResult` directly — the orchestrator throws so it never
    // reaches us, but the resulting failure message must mention the
    // turn count for the operator to act on it.
    let caught: unknown;
    try {
      await agent.invokeAgent(workerStage(), buildSession());
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/12 steps/);
  });

  it('does not consume bridge artifacts when the adapter path fails', async () => {
    // Regression-zero check: even when the adapter path fails, the
    // failure must be raised before the bridge fallback would otherwise
    // run. The orchestrator does NOT silently fall back.
    process.env[WORKER_PILOT_ENV_FLAG] = '1';
    agent.bridgeArtifacts = ['this/should/not/leak.ts'];

    const adapter = new MockExecutionAdapter({
      defaultResult: buildMaxTurnsExhaustedResult(11),
    });
    agent.setInjectedAdapter(adapter);

    await expect(agent.invokeAgent(workerStage(), buildSession())).rejects.toThrow();
    expect(agent.bridgeCalls).toHaveLength(0);
  });

  test.skipIf(!shouldRunRealAdapter())(
    'real-adapter: smoke check that EXEC-005 messages surface intact',
    async () => {
      // Mock-driven even with credentials. Driving the live SDK to maxTurns
      // exhaustion is expensive and offers no incremental coverage — the
      // failure shape is owned by the orchestrator's `toStageOutput`, not
      // by the underlying SDK transport.
      process.env[WORKER_PILOT_ENV_FLAG] = '1';
      const adapter = new MockExecutionAdapter({
        defaultResult: buildMaxTurnsExhaustedResult(15),
      });
      agent.setInjectedAdapter(adapter);

      await expect(agent.invokeAgent(workerStage(), buildSession())).rejects.toThrow(
        /Worker-pilot ExecutionAdapter failed/
      );
    }
  );
});
