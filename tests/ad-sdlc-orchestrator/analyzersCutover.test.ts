/**
 * Analyzer ExecutionAdapter cutover tests
 * (issue #825, AD-13-C).
 *
 * Verifies that the four target Analyzer stages always route through
 * {@link AdsdlcOrchestratorAgent.executeViaAdapter} and never through
 * {@link AdsdlcOrchestratorAgent.executeViaBridge}, regardless of the
 * `AD_SDLC_USE_SDK_FOR_WORKER` feature flag.
 *
 * Stages in scope (4): Code Reader, Codebase Analyzer, Doc-Code
 * Comparator, Impact Analyzer. The 8 Doc Writers stages cut over by
 * AD-13-A (#823) and the 4 Doc Updater + Reader stages cut over by
 * AD-13-B (#824) must keep routing through the adapter; the remaining
 * stages handled by sibling sub-PRs AD-13-D and AD-13-E must still flow
 * through the bridge path.
 *
 * Acceptance Criteria mapping:
 *   AC-1  All 4 Analyzer stages route exclusively through ExecutionAdapter.
 *   AC-2  No `executeViaBridge` call site for these 4 stages.
 *   AC-3  Other stages (e.g. `collector`) still use the bridge path.
 *   AC-4  Routing decision does not depend on the worker feature flag.
 *   AC-5  Doc Writers (AD-13-A) and Doc Updaters + Reader (AD-13-B)
 *         regression-zero: still adapter-routed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AdsdlcOrchestratorAgent,
  ANALYZERS_ADAPTER_AGENT_TYPES,
  DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES,
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

function buildStage(agentType: string, name = 'analyzer-stage'): PipelineStageDefinition {
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
    sessionId: 'analyzers-cutover-test',
    projectDir: '/tmp/analyzers-test',
    userRequest: 'Analyze codebase and documentation',
    mode: 'brownfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: '/tmp/analyzers-test/.ad-sdlc/scratchpad',
    localMode: true,
  };
}

// The full set the AD-13-C cutover applies to. Hard-coded here so the
// test catches accidental drift in `ANALYZERS_ADAPTER_AGENT_TYPES`.
const EXPECTED_ANALYZERS = [
  'code-reader',
  'codebase-analyzer',
  'doc-code-comparator',
  'impact-analyzer',
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Analyzer ExecutionAdapter cutover (#825)', () => {
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
    it('exports the expected set of 4 Analyzer agent types', () => {
      expect(ANALYZERS_ADAPTER_AGENT_TYPES.size).toBe(EXPECTED_ANALYZERS.length);
      for (const agentType of EXPECTED_ANALYZERS) {
        expect(ANALYZERS_ADAPTER_AGENT_TYPES.has(agentType)).toBe(true);
      }
    });

    it('does not include the worker agent type (worker is feature-flag gated)', () => {
      expect(ANALYZERS_ADAPTER_AGENT_TYPES.has('worker')).toBe(false);
    });

    it('is disjoint from the Doc Writers cutover set (AD-13-A)', () => {
      for (const agentType of ANALYZERS_ADAPTER_AGENT_TYPES) {
        expect(DOC_WRITERS_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });

    it('is disjoint from the Doc Updaters + Reader cutover set (AD-13-B)', () => {
      for (const agentType of ANALYZERS_ADAPTER_AGENT_TYPES) {
        expect(DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });
  });

  describe('AC-1: all 4 Analyzers route through the ExecutionAdapter', () => {
    for (const agentType of EXPECTED_ANALYZERS) {
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
      it(`routes code-reader via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('code-reader');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['code-reader']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });

      it(`routes impact-analyzer via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('impact-analyzer');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['impact-analyzer']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });
    }
  });

  describe('AC-3: regression-zero for non-cutover stages', () => {
    it('still routes the collector stage via the bridge path', async () => {
      const stage = buildStage('collector', 'collection');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['collector']);
      expect(orchestrator.adapterCalls).toEqual([]);
    });

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
});
