/**
 * Orchestrator + FeatureFlagsResolver integration tests (Issue #795).
 *
 * Verifies that the worker-pilot dispatch path is selected based on the
 * resolver's priority chain (env > CLI > YAML > default), not on the raw
 * env-var read that #793 introduced.
 *
 * The test subclass overrides `executeViaAdapter` and `executeViaBridge`
 * to surface which path was chosen without running real agent code.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
  public lastRoute: 'adapter' | 'bridge' | null = null;

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

  protected override async executeViaBridge(): Promise<string> {
    this.lastRoute = 'bridge';
    return '{"route":"bridge"}';
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

describe('Orchestrator + FeatureFlagsResolver integration (#795)', () => {
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

  it('routes through bridge by default (env unset, no CLI, no YAML)', async () => {
    const orch = new RouteCapturingOrchestrator({ featureFlagsBaseDir: tmpRoot });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('bridge');
  });

  it('routes through adapter when env AD_SDLC_USE_SDK_FOR_WORKER=1 (regression-zero for #793)', async () => {
    process.env[ENV_USE_SDK_FOR_WORKER] = '1';
    const orch = new RouteCapturingOrchestrator({ featureFlagsBaseDir: tmpRoot });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('adapter');
  });

  it('routes through adapter when CLI --use-sdk-for-worker is supplied (env unset)', async () => {
    const orch = new RouteCapturingOrchestrator({
      featureFlagsBaseDir: tmpRoot,
      featureFlagsCli: { useSdkForWorker: true },
    });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('adapter');
  });

  it('env beats CLI: env=0 forces bridge even if CLI says true', async () => {
    process.env[ENV_USE_SDK_FOR_WORKER] = '0';
    const orch = new RouteCapturingOrchestrator({
      featureFlagsBaseDir: tmpRoot,
      featureFlagsCli: { useSdkForWorker: true },
    });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('bridge');
  });

  it('routes through adapter when YAML enables it (env and CLI absent)', async () => {
    writeFileSync(
      join(tmpRoot, '.ad-sdlc', 'config', 'feature-flags.yaml'),
      'flags:\n  useSdkForWorker: true\n',
      'utf8'
    );
    const orch = new RouteCapturingOrchestrator({ featureFlagsBaseDir: tmpRoot });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('adapter');
  });

  it('CLI beats YAML when env is unset', async () => {
    writeFileSync(
      join(tmpRoot, '.ad-sdlc', 'config', 'feature-flags.yaml'),
      'flags:\n  useSdkForWorker: true\n',
      'utf8'
    );
    const orch = new RouteCapturingOrchestrator({
      featureFlagsBaseDir: tmpRoot,
      featureFlagsCli: { useSdkForWorker: false },
    });
    await orch.dispatchWorker(createSession(tmpRoot));
    expect(orch.lastRoute).toBe('bridge');
  });

  it('non-worker stages always go through bridge regardless of flag', async () => {
    process.env[ENV_USE_SDK_FOR_WORKER] = '1';
    const orch = new RouteCapturingOrchestrator({ featureFlagsBaseDir: tmpRoot });
    const stage: PipelineStageDefinition = {
      name: 'collection',
      agentType: 'collector',
      description: 'Collector stage',
      parallel: false,
      approvalRequired: false,
      dependsOn: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (orch as any).invokeAgent(stage, createSession(tmpRoot));
    expect(orch.lastRoute).toBe('bridge');
  });
});
