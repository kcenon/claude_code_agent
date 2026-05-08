/**
 * Orchestrator + FeatureFlagsResolver integration tests.
 *
 * Pre-#799 these tests asserted that the worker-pilot dispatch path
 * was selected based on the resolver's priority chain (env > CLI >
 * YAML > default). After #799 (orchestrator slim-down following the
 * AD-13 cutover #797) every stage routes through the
 * {@link ExecutionAdapter}; the orchestrator no longer consults the
 * resolver, and the legacy bridge path is gone. The remaining
 * behavioural contract these tests guard is "all stages, including
 * `worker`, route through the adapter regardless of the flag".
 *
 * The full priority-chain semantics of the resolver continue to be
 * covered by `tests/config/feature-flags.test.ts` — this file only
 * exercises the orchestrator's routing decision.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import type {
  OrchestratorConfig,
  OrchestratorSession,
  PipelineStageDefinition,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { ENV_USE_SDK_FOR_WORKER } from '../../src/config/featureFlags.js';

class RouteCapturingOrchestrator extends AdsdlcOrchestratorAgent {
  public lastRoute: 'adapter' | null = null;

  constructor(config: OrchestratorConfig = {}) {
    super(config);
  }

  async dispatchWorker(session: OrchestratorSession): Promise<string> {
    const stage: PipelineStageDefinition = {
      name: 'worker',
      agentType: 'worker',
      description: 'Worker stage',
      parallel: false,
      approvalRequired: false,
      dependsOn: [],
    };
    return this.invokeAgent(stage, session);
  }

  protected override async executeViaAdapter(): Promise<string> {
    this.lastRoute = 'adapter';
    return '{"route":"adapter"}';
  }
}

function createSession(projectDir: string): OrchestratorSession {
  return {
    sessionId: 'fflag-test-session',
    projectDir,
    userRequest: 'test',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: join(projectDir, '.ad-sdlc', 'scratchpad'),
  };
}

function preserveEnvFlag(): () => void {
  const original = process.env[ENV_USE_SDK_FOR_WORKER];
  return () => {
    if (original === undefined) {
      delete process.env[ENV_USE_SDK_FOR_WORKER];
    } else {
      process.env[ENV_USE_SDK_FOR_WORKER] = original;
    }
  };
}

describe('Orchestrator routing post-#799 cutover', () => {
  let tmpRoot: string;
  let restoreEnv: () => void;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'orch-fflag-'));
    mkdirSync(join(tmpRoot, '.ad-sdlc', 'config'), { recursive: true });
    restoreEnv = preserveEnvFlag();
    delete process.env[ENV_USE_SDK_FOR_WORKER];
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('routes the worker stage through the adapter when the env flag is unset', async () => {
    const orch = new RouteCapturingOrchestrator({ featureFlagsBaseDir: tmpRoot });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('adapter');
  });

  it('routes the worker stage through the adapter when env flag is "1"', async () => {
    process.env[ENV_USE_SDK_FOR_WORKER] = '1';
    const orch = new RouteCapturingOrchestrator({ featureFlagsBaseDir: tmpRoot });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('adapter');
  });

  it('routes the worker stage through the adapter when env flag is "0"', async () => {
    // Pre-#799 this would have selected the bridge path; post-cutover the
    // flag has no effect on orchestrator routing.
    process.env[ENV_USE_SDK_FOR_WORKER] = '0';
    const orch = new RouteCapturingOrchestrator({
      featureFlagsBaseDir: tmpRoot,
      featureFlagsCli: { useSdkForWorker: true },
    });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('adapter');
  });

  it('routes the worker stage through the adapter when YAML disables the flag', async () => {
    writeFileSync(
      join(tmpRoot, '.ad-sdlc', 'config', 'feature-flags.yaml'),
      'flags:\n  useSdkForWorker: false\n',
      'utf8'
    );
    const orch = new RouteCapturingOrchestrator({ featureFlagsBaseDir: tmpRoot });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('adapter');
  });

  it('routes a non-worker stage through the adapter regardless of the flag', async () => {
    process.env[ENV_USE_SDK_FOR_WORKER] = '0';
    const orch = new RouteCapturingOrchestrator({ featureFlagsBaseDir: tmpRoot });
    const stage: PipelineStageDefinition = {
      name: 'regression',
      agentType: 'regression-tester',
      description: 'Regression tester stage',
      parallel: false,
      approvalRequired: false,
      dependsOn: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (orch as any).invokeAgent(stage, createSession(tmpRoot));
    expect(orch.lastRoute).toBe('adapter');
  });
});
