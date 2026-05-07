/**
 * T4 — Dependency-conflict scenario (issue #794).
 *
 * The work order depends on prior-stage outputs (e.g. a controller
 * decision document). Verifies that:
 *
 *   1. Only stages with `status: 'completed'` are forwarded into
 *      `priorOutputs` — failed sibling stages must be excluded.
 *   2. Each prior output value is forwarded *verbatim* (this is the
 *      contract the SDK adapter relies on to render the prompt; see
 *      `src/execution/types.ts` `StageExecutionRequest.priorOutputs`).
 *   3. The forwarded keys match the prior stage `name` field (not the
 *      `agentType`), matching the AgentBridge path.
 *
 * **Equivalence axis**: same `priorOutputs` shape on both paths. This
 * scenario does not have a meaningful "bridge artifact set" to compare
 * because the bridge path does not surface its priorOutputs payload via
 * the JSON output — instead the test asserts the contract on the
 * adapter side and falls back to a routing assertion on the bridge
 * side.
 *
 * **Real-adapter arm**: gated by `ANTHROPIC_API_KEY`. See
 * `simple-bug-fix.test.ts` for rationale.
 */

import { describe, it, beforeEach, afterEach, expect, test } from 'vitest';

import { MockExecutionAdapter } from '../../../src/execution/MockExecutionAdapter.js';
import type { StageResult } from '../../../src/ad-sdlc-orchestrator/types.js';

import {
  TestOrchestrator,
  WORKER_PILOT_ENV_FLAG,
  buildSession,
  createTestOrchestrator,
  parseStageOutput,
  preserveWorkerPilotFlag,
  shouldRunRealAdapter,
  workerStage,
} from './_helpers.js';

const PRIOR_CONTROLLER_OUTPUT =
  '{"decision":"split-into-3-subtasks","rationale":"large diff","subtasks":["a","b","c"]}';
const PRIOR_PRD_OUTPUT = '# PRD\n\n## Goals\n- Implement feature X with constraint Y.\n';

const COMPLETED_PRIOR_STAGES: readonly StageResult[] = [
  {
    name: 'orchestration',
    agentType: 'controller',
    status: 'completed',
    durationMs: 12,
    output: PRIOR_CONTROLLER_OUTPUT,
    artifacts: [],
    error: null,
    retryCount: 0,
  },
  {
    name: 'prd_generation',
    agentType: 'prd-writer',
    status: 'completed',
    durationMs: 30,
    output: PRIOR_PRD_OUTPUT,
    artifacts: [],
    error: null,
    retryCount: 0,
  },
];

const FAILED_PRIOR_STAGE: StageResult = {
  name: 'srs_generation',
  agentType: 'srs-writer',
  status: 'failed',
  durationMs: 8,
  output: 'srs-failed-output-must-not-leak',
  artifacts: [],
  error: 'srs gen blew up',
  retryCount: 1,
};

describe('worker-pilot T4-with-deps-conflict: priorOutputs propagation', () => {
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

  it('forwards completed prior outputs verbatim to the adapter', async () => {
    process.env[WORKER_PILOT_ENV_FLAG] = '1';
    const adapter = new MockExecutionAdapter();
    agent.setInjectedAdapter(adapter);

    const session = buildSession({
      stageResults: [...COMPLETED_PRIOR_STAGES, FAILED_PRIOR_STAGE],
      userRequest: 'Implement feature X based on prior controller decision',
    });

    await agent.invokeAgent(workerStage(), session);

    expect(adapter.calls).toHaveLength(1);
    const req = adapter.calls[0];
    expect(req).toBeDefined();

    // Failed stage must be excluded.
    expect(req?.priorOutputs).not.toHaveProperty('srs_generation');

    // Completed stages forwarded verbatim, keyed by stage `name`.
    expect(req?.priorOutputs).toEqual({
      orchestration: PRIOR_CONTROLLER_OUTPUT,
      prd_generation: PRIOR_PRD_OUTPUT,
    });

    // The values are byte-identical, not summarised. This is the contract
    // downstream prompt rendering relies on.
    expect(req?.priorOutputs.orchestration).toBe(PRIOR_CONTROLLER_OUTPUT);
    expect(req?.priorOutputs.prd_generation).toBe(PRIOR_PRD_OUTPUT);
  });

  it('routes via bridge when flag is off, regardless of priorOutputs', async () => {
    // Regression-zero check: when the flag is off, the priorOutputs
    // mechanism is not exercised at all and the bridge path is taken.
    agent.bridgeArtifacts = ['src/feature-x.ts'];
    const session = buildSession({ stageResults: [...COMPLETED_PRIOR_STAGES] });
    const output = await agent.invokeAgent(workerStage(), session);
    const parsed = parseStageOutput(output);
    expect(parsed.via).toBe('agent-bridge');
    expect(agent.adapterCalls).toHaveLength(0);
  });

  it('handles an empty priorOutputs map without leaking entries', async () => {
    // Defensive: when no prior stages have completed, priorOutputs must
    // be an empty object — not undefined, not null, not partially
    // populated. This guards against accidental "kitchen-sink"
    // serialisation into the prompt.
    process.env[WORKER_PILOT_ENV_FLAG] = '1';
    const adapter = new MockExecutionAdapter();
    agent.setInjectedAdapter(adapter);

    await agent.invokeAgent(workerStage(), buildSession());

    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]?.priorOutputs).toEqual({});
  });

  test.skipIf(!shouldRunRealAdapter())(
    'real-adapter: smoke check that priorOutputs survive the gate',
    async () => {
      // Mock-driven smoke even with credentials. See simple-bug-fix.test.ts
      // for why we don't actually call the live SDK on this scenario.
      process.env[WORKER_PILOT_ENV_FLAG] = '1';
      const adapter = new MockExecutionAdapter();
      agent.setInjectedAdapter(adapter);

      await agent.invokeAgent(
        workerStage(),
        buildSession({ stageResults: [...COMPLETED_PRIOR_STAGES] })
      );

      expect(adapter.calls[0]?.priorOutputs.orchestration).toBe(PRIOR_CONTROLLER_OUTPUT);
    }
  );
});
