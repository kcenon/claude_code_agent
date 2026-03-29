/**
 * Tests for scaffold-aware adapter integration in AgentDispatcher.
 *
 * Verifies that the dispatcher routes execution stages to
 * ExecutionScaffoldGenerator when session.localMode is true
 * and the bridge is a stub.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { AgentDispatcher } from '../../src/agents/AgentDispatcher.js';
import { BridgeRegistry } from '../../src/agents/BridgeRegistry.js';
import type {
  OrchestratorSession,
  PipelineStageDefinition,
} from '../../src/ad-sdlc-orchestrator/types.js';

function makeStage(agentType: string, name: string): PipelineStageDefinition {
  return {
    name: name as PipelineStageDefinition['name'],
    agentType,
    description: `Test ${agentType}`,
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
  };
}

function makeSession(
  projectDir: string,
  scratchpadDir: string,
  localMode: boolean
): OrchestratorSession {
  return {
    sessionId: 'disp-test',
    projectDir,
    userRequest: 'test',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir,
    localMode,
  };
}

describe('AgentDispatcher scaffold adapter integration', () => {
  let tmpDir: string;
  let projectDir: string;
  let scratchpadDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'disp-scaffold-'));
    projectDir = join(tmpDir, 'test-project');
    scratchpadDir = join(tmpDir, 'scratchpad');
    await mkdir(projectDir, { recursive: true });
    await mkdir(scratchpadDir, { recursive: true });
  });

  // Cleanup
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should use scaffold generator for controller in localMode + stub', async () => {
    // No real bridges → everything is stub
    const registry = new BridgeRegistry();
    const dispatcher = new AgentDispatcher(registry);

    // Inject a mock agent for the controller type
    const mockAgent = {
      agentId: 'controller',
      name: 'Mock Controller',
      initialize: async () => {},
      dispose: async () => {},
    };
    dispatcher.setAgent('controller', mockAgent);

    const session = makeSession(projectDir, scratchpadDir, true);
    const stage = makeStage('controller', 'orchestration');

    const output = await dispatcher.dispatch(stage, session);
    const result = JSON.parse(output);

    expect(result.stage).toBe('controller');
    expect(result.scaffold).toBe(true);
  });

  it('should use scaffold generator for worker in localMode + stub', async () => {
    const registry = new BridgeRegistry();
    const dispatcher = new AgentDispatcher(registry);

    const mockAgent = {
      agentId: 'worker',
      name: 'Mock Worker',
      initialize: async () => {},
      dispose: async () => {},
    };
    dispatcher.setAgent('worker', mockAgent);

    const session = makeSession(projectDir, scratchpadDir, true);
    const stage = makeStage('worker', 'implementation');

    const output = await dispatcher.dispatch(stage, session);
    const result = JSON.parse(output);

    expect(result.stage).toBe('worker');
    expect(result.scaffold).toBe(true);
  });

  it('should use scaffold generator for validation in localMode + stub', async () => {
    const registry = new BridgeRegistry();
    const dispatcher = new AgentDispatcher(registry);

    const mockAgent = {
      agentId: 'validation-agent',
      name: 'Mock Validation',
      initialize: async () => {},
      dispose: async () => {},
    };
    dispatcher.setAgent('validation', mockAgent);

    const session = makeSession(projectDir, scratchpadDir, true);
    const stage = makeStage('validation', 'validation');

    const output = await dispatcher.dispatch(stage, session);
    const result = JSON.parse(output);

    expect(result.stage).toBe('validation');
    expect(result.scaffold).toBe(true);
  });

  it('should use scaffold generator for pr-reviewer in localMode + stub', async () => {
    const registry = new BridgeRegistry();
    const dispatcher = new AgentDispatcher(registry);

    const mockAgent = {
      agentId: 'local-review-agent',
      name: 'Mock Reviewer',
      initialize: async () => {},
      dispose: async () => {},
    };
    dispatcher.setAgent('pr-reviewer', mockAgent);

    const session = makeSession(projectDir, scratchpadDir, true);
    const stage = makeStage('pr-reviewer', 'review');

    const output = await dispatcher.dispatch(stage, session);
    const result = JSON.parse(output);

    expect(result.stage).toBe('review');
    expect(result.scaffold).toBe(true);
  });

  it('should NOT use scaffold when localMode is false', async () => {
    const registry = new BridgeRegistry();
    const dispatcher = new AgentDispatcher(registry);

    const mockAgent = {
      agentId: 'controller',
      name: 'Mock Controller',
      initialize: async () => {},
      dispose: async () => {},
    };
    dispatcher.setAgent('controller', mockAgent);

    // localMode = false
    const session = makeSession(projectDir, scratchpadDir, false);
    const stage = makeStage('controller', 'orchestration');

    const output = await dispatcher.dispatch(stage, session);

    // Should fall through to defaultAdapter which returns a generic string
    // (mock agent has no execute/analyze/generateFromProject methods)
    expect(output).toContain('Agent controller executed for stage');
  });
});
