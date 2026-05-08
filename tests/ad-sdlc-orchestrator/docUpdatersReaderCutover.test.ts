/**
 * Doc Updaters + Reader ExecutionAdapter cutover tests
 * (issue #824, AD-13-B).
 *
 * Verifies that the four target stages always route through
 * {@link AdsdlcOrchestratorAgent.executeViaAdapter} and never through
 * {@link AdsdlcOrchestratorAgent.executeViaBridge}, regardless of the
 * `AD_SDLC_USE_SDK_FOR_WORKER` feature flag.
 *
 * Stages in scope (4): PRD Updater, SRS Updater, SDS Updater, Document
 * Reader. The 8 Doc Writers stages cut over by AD-13-A (#823) must keep
 * routing through the adapter; the remaining 21 stages handled by
 * sibling sub-PRs AD-13-C..E must still flow through the bridge path.
 *
 * Acceptance Criteria mapping:
 *   AC-1  All 4 stages route exclusively through ExecutionAdapter.
 *   AC-2  No `executeViaBridge` call site for these 4 stages.
 *   AC-3  Other stages (e.g. `collector`) still use the bridge path.
 *   AC-4  Routing decision does not depend on the worker feature flag.
 *   AC-5  Doc Writers (AD-13-A) regression-zero: still adapter-routed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AdsdlcOrchestratorAgent,
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

function buildStage(agentType: string, name = 'doc-updater-stage'): PipelineStageDefinition {
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
    sessionId: 'doc-updaters-reader-cutover-test',
    projectDir: '/tmp/doc-updaters-test',
    userRequest: 'Update documentation artifacts',
    mode: 'brownfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: '/tmp/doc-updaters-test/.ad-sdlc/scratchpad',
    localMode: true,
  };
}

// The full set the AD-13-B cutover applies to. Hard-coded here so the
// test catches accidental drift in `DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES`.
const EXPECTED_DOC_UPDATERS_READER = [
  'prd-updater',
  'srs-updater',
  'sds-updater',
  'document-reader',
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Doc Updaters + Reader ExecutionAdapter cutover (#824)', () => {
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
    it('exports the expected set of 4 Doc Updater + Reader agent types', () => {
      expect(DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES.size).toBe(
        EXPECTED_DOC_UPDATERS_READER.length
      );
      for (const agentType of EXPECTED_DOC_UPDATERS_READER) {
        expect(DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES.has(agentType)).toBe(true);
      }
    });

    it('does not include the worker agent type (worker is feature-flag gated)', () => {
      expect(DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES.has('worker')).toBe(false);
    });

    it('is disjoint from the Doc Writers cutover set (AD-13-A)', () => {
      for (const agentType of DOC_UPDATERS_READER_ADAPTER_AGENT_TYPES) {
        expect(DOC_WRITERS_ADAPTER_AGENT_TYPES.has(agentType)).toBe(false);
      }
    });
  });

  describe('AC-1: all 4 Doc Updaters + Reader route through the ExecutionAdapter', () => {
    for (const agentType of EXPECTED_DOC_UPDATERS_READER) {
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
      it(`routes prd-updater via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('prd-updater');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['prd-updater']);
        expect(orchestrator.bridgeCalls).toEqual([]);
      });

      it(`routes document-reader via adapter when flag is "${flagValue}"`, async () => {
        process.env[WORKER_PILOT_ENV_FLAG] = flagValue;
        const stage = buildStage('document-reader');
        const session = buildSession();

        await orchestrator.callInvokeAgent(stage, session);

        expect(orchestrator.adapterCalls).toEqual(['document-reader']);
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

    it('still routes the code-reader stage via the bridge path', async () => {
      const stage = buildStage('code-reader', 'code_reading');
      const session = buildSession();

      await orchestrator.callInvokeAgent(stage, session);

      expect(orchestrator.bridgeCalls).toEqual(['code-reader']);
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
});
