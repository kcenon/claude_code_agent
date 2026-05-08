/**
 * Setup + Collection ExecutionAdapter cutover tests
 * (issue #826, AD-13-D).
 *
 * Verifies that the six target Setup + Collection stages always route
 * through {@link AdsdlcOrchestratorAgent.executeViaAdapter} and never
 * through {@link AdsdlcOrchestratorAgent.executeViaBridge}, regardless
 * of the `AD_SDLC_USE_SDK_FOR_WORKER` feature flag.
 *
 * Stages in scope (6): Project Initializer, Mode Detector, Repo
 * Detector, GitHub Setup, Collector, Issue Reader. The 8 Doc Writers
 * stages cut over by AD-13-A (#823), the 4 Doc Updater + Reader stages
 * cut over by AD-13-B (#824), and the 4 Analyzer stages cut over by
 * AD-13-C (#825) must keep routing through the adapter; the remaining
 * stages handled by the final sibling sub-PR AD-13-E must still flow
 * through the bridge path.
 *
 * Acceptance Criteria mapping:
 *   AC-1  All 6 Setup + Collection stages route exclusively through
 *         ExecutionAdapter.
 *   AC-2  No `executeViaBridge` call site for these 6 stages.
 *   AC-3  Other stages (e.g. `issue-generator`, `controller`) still use
 *         the bridge path.
 *   AC-4  Routing decision does not depend on the worker feature flag.
 *   AC-5  Doc Writers (AD-13-A), Doc Updaters + Reader (AD-13-B), and
 *         Analyzers (AD-13-C) regression-zero: still adapter-routed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AdsdlcOrchestratorAgent,
  ANALYZERS_ADAPTER_AGENT_TYPES,
  DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES,
  DOC_WRITERS_ADAPTER_AGENT_TYPES,
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

function buildStage(agentType: string, name = 'setup-stage'): PipelineStageDefinition {
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
    sessionId: 'setup-collection-cutover-test',
    projectDir: '/tmp/setup-collection-test',
    userRequest: 'Initialize project and collect inputs',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: '/tmp/setup-collection-test/.ad-sdlc/scratchpad',
    localMode: true,
  };
}

// The full set the AD-13-D cutover applies to. Hard-coded here so the
// test catches accidental drift in `SETUP_COLLECTION_ADAPTER_AGENT_TYPES`.
const EXPECTED_SETUP_COLLECTION = [
  'project-initializer',
  'mode-detector',
  'repo-detector',
  'github-repo-setup',
  'collector',
  'issue-reader',
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Setup + Collection ExecutionAdapter cutover (#826)', () => {
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
    it('exports the expected set of 6 Setup + Collection agent types', () => {
      expect(SETUP_COLLECTION_ADAPTER_AGENT_TYPES.size).toBe(EXPECTED_SETUP_COLLECTION.length);
      for (const agentType of EXPECTED_SETUP_COLLECTION) {
        expect(SETUP_COLLECTION_ADAPTER_AGENT_TYPES.has(agentType)).toBe(true);
      }
    });

    it('does not include the worker agent type (worker is feature-flag gated)', () => {
      expect(SETUP_COLLECTION_ADAPTER_AGENT_TYPES.has('worker')).toBe(false);
    });

    it('is disjoint from the Doc Writers cutover set (AD-13-A)', () => {
      for (const agentType of SETUP_COLLECTION_ADAPTER_AGENT_TYPES) {
        expect(DOC_WRITERS_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });

    it('is disjoint from the Doc Updaters + Reader cutover set (AD-13-B)', () => {
      for (const agentType of SETUP_COLLECTION_ADAPTER_AGENT_TYPES) {
        expect(DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });

    it('is disjoint from the Analyzer cutover set (AD-13-C)', () => {
      for (const agentType of SETUP_COLLECTION_ADAPTER_AGENT_TYPES) {
        expect(ANALYZERS_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });
  });

  describe('AC-1: all 6 Setup + Collection stages route through the ExecutionAdapter', () => {
    for (const agentType of EXPECTED_SETUP_COLLECTION) {
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
      it(`routes project-initializer via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('project-initializer');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['project-initializer']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });

      it(`routes collector via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('collector');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['collector']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });

      it(`routes issue-reader via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('issue-reader');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['issue-reader']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });
    }
  });

  describe('AC-3: regression-zero for non-cutover stages', () => {
    it('still routes the issue-generator stage via the bridge path', async () => {
      const stage = buildStage('issue-generator', 'issue_generation');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['issue-generator']);
      expect(orchestrator.adapterCalls).toEqual([]);
    });

    it('still routes the controller stage via the bridge path', async () => {
      const stage = buildStage('controller', 'orchestration');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['controller']);
      expect(orchestrator.adapterCalls).toEqual([]);
    });

    it('still routes the validation-agent stage via the bridge path', async () => {
      const stage = buildStage('validation-agent', 'validation');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['validation-agent']);
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
});
