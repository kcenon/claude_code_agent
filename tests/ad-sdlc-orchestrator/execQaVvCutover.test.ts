/**
 * Execution + QA + V&V ExecutionAdapter cutover tests
 * (issue #827, AD-13-E — final sub-PR of AD-13 meta #797).
 *
 * Verifies that the nine target Execution, QA, and V&V stages always
 * route through {@link AdsdlcOrchestratorAgent.executeViaAdapter} and
 * never through {@link AdsdlcOrchestratorAgent.executeViaBridge},
 * regardless of the `AD_SDLC_USE_SDK_FOR_WORKER` feature flag.
 *
 * Stages in scope (9): Controller, Issue Generator, PR Reviewer, CI
 * Fixer, Regression Tester, Stage Verifier, RTM Builder, Validation
 * Agent, Doc Index Generator. With this final cutover all 33
 * cutover-target stages route through the adapter and AD-13 (#797) is
 * complete. The Doc Writers (AD-13-A), Doc Updaters + Reader (AD-13-B),
 * Analyzers (AD-13-C), and Setup + Collection (AD-13-D) sets must keep
 * routing through the adapter. Only the feature-flag-gated `worker`
 * pilot retains a conditional bridge fallback until #795 promotes it.
 *
 * Acceptance Criteria mapping:
 *   AC-1  All 9 Exec + QA + V&V stages route exclusively through
 *         ExecutionAdapter.
 *   AC-2  No `executeViaBridge` call site for these 9 stages.
 *   AC-3  Worker stage still respects the feature flag (gated cutover).
 *   AC-4  Routing decision does not depend on the worker feature flag
 *         for the AD-13-E set.
 *   AC-5  AD-13-A/B/C/D regression-zero: still adapter-routed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AdsdlcOrchestratorAgent,
  ANALYZERS_ADAPTER_AGENT_TYPES,
  DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES,
  DOC_WRITERS_ADAPTER_AGENT_TYPES,
  EXEC_QA_VV_ADAPTER_AGENT_TYPES,
  SETUP_COLLECTION_ADAPTER_AGENT_TYPES,
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

function buildStage(agentType: string, name = 'exec-qa-vv-stage'): PipelineStageDefinition {
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
    sessionId: 'exec-qa-vv-cutover-test',
    projectDir: '/tmp/exec-qa-vv-test',
    userRequest: 'Execute pipeline implementation, QA, and validation',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: '/tmp/exec-qa-vv-test/.ad-sdlc/scratchpad',
    localMode: true,
  };
}

// The full set the AD-13-E cutover applies to. Hard-coded here so the
// test catches accidental drift in `EXEC_QA_VV_ADAPTER_AGENT_TYPES`.
const EXPECTED_EXEC_QA_VV = [
  'controller',
  'issue-generator',
  'pr-reviewer',
  'ci-fixer',
  'regression-tester',
  'stage-verifier',
  'rtm-builder',
  'validation-agent',
  'doc-index-generator',
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Execution + QA + V&V ExecutionAdapter cutover (#827)', () => {
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
    it('exports the expected set of 9 Execution + QA + V&V agent types', () => {
      expect(EXEC_QA_VV_ADAPTER_AGENT_TYPES.size).toBe(EXPECTED_EXEC_QA_VV.length);
      for (const agentType of EXPECTED_EXEC_QA_VV) {
        expect(EXEC_QA_VV_ADAPTER_AGENT_TYPES.has(agentType)).toBe(true);
      }
    });

    it('does not include the worker agent type (worker is feature-flag gated)', () => {
      expect(EXEC_QA_VV_ADAPTER_AGENT_TYPES.has('worker')).toBe(false);
    });

    it('is disjoint from the Doc Writers cutover set (AD-13-A)', () => {
      for (const agentType of EXEC_QA_VV_ADAPTER_AGENT_TYPES) {
        expect(DOC_WRITERS_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });

    it('is disjoint from the Doc Updaters + Reader cutover set (AD-13-B)', () => {
      for (const agentType of EXEC_QA_VV_ADAPTER_AGENT_TYPES) {
        expect(DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });

    it('is disjoint from the Analyzer cutover set (AD-13-C)', () => {
      for (const agentType of EXEC_QA_VV_ADAPTER_AGENT_TYPES) {
        expect(ANALYZERS_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });

    it('is disjoint from the Setup + Collection cutover set (AD-13-D)', () => {
      for (const agentType of EXEC_QA_VV_ADAPTER_AGENT_TYPES) {
        expect(SETUP_COLLECTION_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });
  });

  describe('AC-1: all 9 Exec + QA + V&V stages route through the ExecutionAdapter', () => {
    for (const agentType of EXPECTED_EXEC_QA_VV) {
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
      it(`routes controller via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('controller');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['controller']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });

      it(`routes issue-generator via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('issue-generator');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['issue-generator']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });

      it(`routes validation-agent via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('validation-agent');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['validation-agent']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });
    }
  });

  describe('AC-3: worker stage still respects the feature flag', () => {
    it('routes worker via bridge when feature flag is unset', async () => {
      delete process.env[WORKER_PILOT_ENV_FLAG];
      const stage = buildStage('worker', 'implementation');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['worker']);
      expect(orchestrator.adapterCalls).toEqual([]);
    });

    it('routes worker via adapter when feature flag is on', async () => {
      process.env[WORKER_PILOT_ENV_FLAG] = '1';
      const stage = buildStage('worker', 'implementation');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.adapterCalls).toEqual(['worker']);
      expect(orchestrator.bridgeCalls).toEqual([]);
    });
  });

  describe('AC-5: AD-13-A Doc Writers regression-zero', () => {
    for (const agentType of DOC_WRITERS_ADAPTER_AGENT_TYPES) {
      it(`Doc Writer ${agentType} still routes via the adapter`, async () => {
        const stage = buildStage(agentType);
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual([agentType]);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });
    }
  });

  describe('AC-5: AD-13-B Doc Updaters + Reader regression-zero', () => {
    for (const agentType of DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES) {
      it(`Doc Updater/Reader ${agentType} still routes via the adapter`, async () => {
        const stage = buildStage(agentType);
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual([agentType]);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });
    }
  });

  describe('AC-5: AD-13-C Analyzers regression-zero', () => {
    for (const agentType of ANALYZERS_ADAPTER_AGENT_TYPES) {
      it(`Analyzer ${agentType} still routes via the adapter`, async () => {
        const stage = buildStage(agentType);
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual([agentType]);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });
    }
  });

  describe('AC-5: AD-13-D Setup + Collection regression-zero', () => {
    for (const agentType of SETUP_COLLECTION_ADAPTER_AGENT_TYPES) {
      it(`Setup + Collection ${agentType} still routes via the adapter`, async () => {
        const stage = buildStage(agentType);
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual([agentType]);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });
    }
  });
});
