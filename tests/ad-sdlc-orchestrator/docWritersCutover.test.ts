/**
 * Doc Writers ExecutionAdapter cutover tests (issue #823, AD-13-A).
 *
 * Verifies that the eight Doc Writers stages always route through
 * {@link AdsdlcOrchestratorAgent.executeViaAdapter} and never through
 * {@link AdsdlcOrchestratorAgent.executeViaBridge}, regardless of the
 * `AD_SDLC_USE_SDK_FOR_WORKER` feature flag.
 *
 * Stages in scope (8): PRD, SRS, SDP, SDS, UI, Threat Model, Tech
 * Decision, SVP Writers. The remaining stages (handled by sibling
 * sub-PRs AD-13-B..E) must still flow through the bridge path; that
 * regression-zero promise is asserted via a still-bridge stage such as
 * `regression-tester`. (After AD-13-D landed, the previously-bridge
 * `collector` stage is now adapter-routed, so the regression probe was
 * retargeted.)
 *
 * Acceptance Criteria mapping:
 *   AC-1  All 8 stages route exclusively through ExecutionAdapter.
 *   AC-2  No `executeViaBridge` call site for these 8 stages.
 *   AC-3  Other stages (e.g. `regression-tester`) still use the bridge
 *         path.
 *   AC-4  Routing decision does not depend on the worker feature flag.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AdsdlcOrchestratorAgent,
  DOC_WRITERS_ADAPTER_AGENT_TYPES,
  WORKER_PILOT_ENV_FLAG,
} from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import type {
  OrchestratorSession,
  PipelineStageDefinition,
} from '../../src/ad-sdlc-orchestrator/types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Test subclass that records which routing path was selected for each
 * `invokeAgent` call. Both `executeViaBridge` and `executeViaAdapter`
 * are stubbed so no real agent execution occurs.
 */
class RoutingProbeOrchestrator extends AdsdlcOrchestratorAgent {
  bridgeCalls: string[] = [];
  adapterCalls: string[] = [];

  async callInvokeAgent(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<string> {
    return this.invokeAgent(stage, session);
  }

  protected override async executeViaBridge(
    stage: PipelineStageDefinition,
    _session: OrchestratorSession
  ): Promise<string> {
    this.bridgeCalls.push(stage.agentType);
    return JSON.stringify({ via: 'agent-bridge', agentType: stage.agentType });
  }

  protected override async executeViaAdapter(
    stage: PipelineStageDefinition,
    _session: OrchestratorSession
  ): Promise<string> {
    this.adapterCalls.push(stage.agentType);
    return JSON.stringify({ via: 'execution-adapter', agentType: stage.agentType });
  }
}

function buildStage(agentType: string, name = 'doc-writer-stage'): PipelineStageDefinition {
  return {
    name: name as PipelineStageDefinition['name'],
    agentType,
    description: `Test stage for ${agentType}`,
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
  };
}

function buildSession(): OrchestratorSession {
  return {
    sessionId: 'doc-writers-cutover-test',
    projectDir: '/tmp/doc-writers-test',
    userRequest: 'Generate documentation artifacts',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: '/tmp/doc-writers-test/.ad-sdlc/scratchpad',
    localMode: true,
  };
}

// The full set the cutover applies to. Hard-coded here so the test
// catches accidental drift in `DOC_WRITERS_ADAPTER_AGENT_TYPES`.
const EXPECTED_DOC_WRITERS = [
  'prd-writer',
  'srs-writer',
  'sdp-writer',
  'sds-writer',
  'ui-spec-writer',
  'threat-model-writer',
  'tech-decision-writer',
  'svp-writer',
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Doc Writers ExecutionAdapter cutover (#823)', () => {
  let originalFlag: string | undefined;
  let orchestrator: RoutingProbeOrchestrator;

  beforeEach(() => {
    originalFlag = process.env[WORKER_PILOT_ENV_FLAG];
    delete process.env[WORKER_PILOT_ENV_FLAG];
    orchestrator = new RoutingProbeOrchestrator();
  });

  afterEach(async () => {
    if (originalFlag === undefined) {
      delete process.env[WORKER_PILOT_ENV_FLAG];
    } else {
      process.env[WORKER_PILOT_ENV_FLAG] = originalFlag;
    }
    await orchestrator.dispose().catch(() => {
      // tolerate dispose errors in cleanup
    });
  });

  describe('Constant integrity', () => {
    it('exports the expected set of 8 Doc Writers agent types', () => {
      expect(DOC_WRITERS_ADAPTER_AGENT_TYPES.size).toBe(EXPECTED_DOC_WRITERS.length);
      for (const agentType of EXPECTED_DOC_WRITERS) {
        expect(DOC_WRITERS_ADAPTER_AGENT_TYPES.has(agentType)).toBe(true);
      }
    });

    it('does not include the worker agent type (worker is feature-flag gated)', () => {
      expect(DOC_WRITERS_ADAPTER_AGENT_TYPES.has('worker')).toBe(false);
    });
  });

  describe('AC-1: all 8 Doc Writers route through the ExecutionAdapter', () => {
    for (const agentType of EXPECTED_DOC_WRITERS) {
      it(`routes ${agentType} via executeViaAdapter (flag unset)`, async () => {
        const stage = buildStage(agentType);
        const session = buildSession();

        const output = await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual([agentType]);
        expect(orchestrator.bridgeCalls).toEqual([]);
        expect(JSON.parse(output)).toMatchObject({
          via: 'execution-adapter',
          agentType,
        });
      });
    }
  });

  describe('AC-4: routing is independent of AD_SDLC_USE_SDK_FOR_WORKER', () => {
    for (const flagValue of ['1', '0', 'true', 'false']) {
      it(`routes prd-writer via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('prd-writer');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['prd-writer']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });
    }
  });

  describe('AC-3: regression-zero for other stages', () => {
    it('still routes the regression-tester stage via the bridge path', async () => {
      const stage = buildStage('regression-tester', 'regression');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['regression-tester']);
      expect(orchestrator.adapterCalls).toEqual([]);
    });

    it('still routes the issue-generator stage via the bridge path', async () => {
      const stage = buildStage('issue-generator', 'issue_generation');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['issue-generator']);
      expect(orchestrator.adapterCalls).toEqual([]);
    });

    it('routes worker via bridge when feature flag is unset (regression-zero)', async () => {
      delete process.env[WORKER_PILOT_ENV_FLAG];
      const stage = buildStage('worker', 'implementation');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['worker']);
      expect(orchestrator.adapterCalls).toEqual([]);
    });

    it('routes worker via adapter when feature flag is on (existing #795 behaviour)', async () => {
      process.env[WORKER_PILOT_ENV_FLAG] = '1';
      const stage = buildStage('worker', 'implementation');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.adapterCalls).toEqual(['worker']);
      expect(orchestrator.bridgeCalls).toEqual([]);
    });
  });
});
