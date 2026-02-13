/**
 * ControlPlane facade tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ControlPlane,
  getControlPlane,
  resetControlPlane,
  ControlPlaneError,
  PipelineOperationError,
  AgentRegistryError,
} from '../../src/control-plane/ControlPlane.js';
import type { AgentStatus, AgentInfo } from '../../src/control-plane/ControlPlane.js';
import { ControlPlaneErrorCodes } from '../../src/errors/codes.js';

describe('ControlPlane', () => {
  beforeEach(() => {
    resetControlPlane();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const a = getControlPlane();
      const b = getControlPlane();
      expect(a).toBe(b);
    });

    it('should return a new instance after reset', () => {
      const a = getControlPlane();
      resetControlPlane();
      const b = getControlPlane();
      expect(a).not.toBe(b);
    });

    it('should accept options on first creation', () => {
      const cp = getControlPlane({ stateManager: { basePath: '/tmp/claude/test-sm' } });
      expect(cp).toBeInstanceOf(ControlPlane);
    });
  });

  // -----------------------------------------------------------------------
  // Agent registry
  // -----------------------------------------------------------------------

  describe('agent registry', () => {
    let cp: ControlPlane;

    beforeEach(() => {
      cp = new ControlPlane();
    });

    it('should register a new agent', () => {
      const info = cp.registerAgent('collector', 'Collector Agent');
      expect(info.id).toBe('collector');
      expect(info.name).toBe('Collector Agent');
      expect(info.status).toBe('registered');
      expect(info.lastUpdated).toBeDefined();
      expect(info.metadata).toEqual({});
    });

    it('should register an agent with metadata', () => {
      const info = cp.registerAgent('worker', 'Worker Agent', { pipeline: 'greenfield' });
      expect(info.metadata).toEqual({ pipeline: 'greenfield' });
    });

    it('should throw when registering duplicate agent', () => {
      cp.registerAgent('collector', 'Collector Agent');
      expect(() => cp.registerAgent('collector', 'Collector Agent'))
        .toThrow(AgentRegistryError);
    });

    it('should throw AgentRegistryError with correct code for duplicate', () => {
      cp.registerAgent('collector', 'Collector Agent');
      try {
        cp.registerAgent('collector', 'Duplicate');
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentRegistryError);
        expect((error as AgentRegistryError).code).toBe(ControlPlaneErrorCodes.CPL_AGENT_ALREADY_REGISTERED);
      }
    });

    it('should update agent status', () => {
      cp.registerAgent('collector', 'Collector Agent');
      const updated = cp.updateAgentStatus('collector', 'ready');
      expect(updated.status).toBe('ready');
    });

    it('should throw when updating unregistered agent', () => {
      expect(() => cp.updateAgentStatus('unknown', 'ready'))
        .toThrow(AgentRegistryError);
    });

    it('should throw with correct code for unregistered agent', () => {
      try {
        cp.updateAgentStatus('unknown', 'ready');
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentRegistryError);
        expect((error as AgentRegistryError).code).toBe(ControlPlaneErrorCodes.CPL_AGENT_NOT_REGISTERED);
      }
    });

    it('should unregister an agent', () => {
      cp.registerAgent('collector', 'Collector Agent');
      expect(cp.unregisterAgent('collector')).toBe(true);
      expect(cp.getAgent('collector')).toBeUndefined();
    });

    it('should return false when unregistering unknown agent', () => {
      expect(cp.unregisterAgent('unknown')).toBe(false);
    });

    it('should get agent info', () => {
      cp.registerAgent('collector', 'Collector Agent');
      const info = cp.getAgent('collector');
      expect(info).toBeDefined();
      expect(info!.id).toBe('collector');
    });

    it('should return undefined for unknown agent', () => {
      expect(cp.getAgent('unknown')).toBeUndefined();
    });

    it('should list all agents', () => {
      cp.registerAgent('a', 'Agent A');
      cp.registerAgent('b', 'Agent B');
      const all = cp.listAgents();
      expect(all).toHaveLength(2);
    });

    it('should list agents filtered by status', () => {
      cp.registerAgent('a', 'Agent A');
      cp.registerAgent('b', 'Agent B');
      cp.updateAgentStatus('a', 'ready');
      const ready = cp.listAgents('ready');
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('a');
    });

    it('should track status transitions', () => {
      cp.registerAgent('worker', 'Worker');
      const statuses: AgentStatus[] = ['initializing', 'ready', 'busy', 'ready', 'disposed'];
      for (const s of statuses) {
        const info = cp.updateAgentStatus('worker', s);
        expect(info.status).toBe(s);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Error classes
  // -----------------------------------------------------------------------

  describe('error classes', () => {
    it('ControlPlaneError should extend AppError', () => {
      const error = new ControlPlaneError(
        ControlPlaneErrorCodes.CPL_INIT_ERROR,
        'Init failed',
      );
      expect(error.name).toBe('ControlPlaneError');
      expect(error.code).toBe('CPL-030');
      expect(error.message).toBe('Init failed');
      expect(error.isRetryable()).toBe(true); // recoverable category
    });

    it('PipelineOperationError should map operations to codes', () => {
      const startErr = new PipelineOperationError('start', 'Cannot start');
      expect(startErr.code).toBe(ControlPlaneErrorCodes.CPL_PIPELINE_START_ERROR);
      expect(startErr.name).toBe('PipelineOperationError');

      const resumeErr = new PipelineOperationError('resume', 'Cannot resume');
      expect(resumeErr.code).toBe(ControlPlaneErrorCodes.CPL_PIPELINE_RESUME_ERROR);

      const stateErr = new PipelineOperationError('state', 'Bad state');
      expect(stateErr.code).toBe(ControlPlaneErrorCodes.CPL_PIPELINE_STATE_ERROR);
    });

    it('PipelineOperationError should include operation in context', () => {
      const error = new PipelineOperationError('start', 'test');
      expect(error.context).toEqual(expect.objectContaining({ operation: 'start' }));
    });

    it('AgentRegistryError should map reasons to codes', () => {
      const notReg = new AgentRegistryError('x', 'not_registered', 'Not found');
      expect(notReg.code).toBe(ControlPlaneErrorCodes.CPL_AGENT_NOT_REGISTERED);

      const alreadyReg = new AgentRegistryError('x', 'already_registered', 'Exists');
      expect(alreadyReg.code).toBe(ControlPlaneErrorCodes.CPL_AGENT_ALREADY_REGISTERED);

      const lifecycle = new AgentRegistryError('x', 'lifecycle', 'Error');
      expect(lifecycle.code).toBe(ControlPlaneErrorCodes.CPL_AGENT_LIFECYCLE_ERROR);
    });

    it('AgentRegistryError should include agentId in context', () => {
      const error = new AgentRegistryError('my-agent', 'not_registered', 'test');
      expect(error.context).toEqual(expect.objectContaining({ agentId: 'my-agent' }));
    });

    it('ControlPlaneError should serialize to JSON', () => {
      const error = new ControlPlaneError(
        ControlPlaneErrorCodes.CPL_INIT_ERROR,
        'Init failed',
        { context: { projectId: 'proj-1' } },
      );
      const json = error.toJSON();
      expect(json.code).toBe('CPL-030');
      expect(json.message).toBe('Init failed');
      expect(json.context).toEqual({ projectId: 'proj-1' });
    });

    it('error wrapping should preserve cause chain', () => {
      const original = new Error('underlying issue');
      const wrapped = new ControlPlaneError(
        ControlPlaneErrorCodes.CPL_PIPELINE_START_ERROR,
        'Pipeline failed',
        { cause: original },
      );
      expect(wrapped.cause).toBe(original);
    });
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  describe('cleanup', () => {
    it('should clear agent registry on cleanup', async () => {
      const cp = new ControlPlane();
      cp.registerAgent('a', 'Agent A');
      cp.registerAgent('b', 'Agent B');
      expect(cp.listAgents()).toHaveLength(2);
      await cp.cleanup();
      expect(cp.listAgents()).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Error codes integration
// ---------------------------------------------------------------------------

describe('ControlPlane error codes', () => {
  it('should have all CPL codes defined', () => {
    expect(ControlPlaneErrorCodes.CPL_PIPELINE_START_ERROR).toBe('CPL-001');
    expect(ControlPlaneErrorCodes.CPL_PIPELINE_RESUME_ERROR).toBe('CPL-002');
    expect(ControlPlaneErrorCodes.CPL_PIPELINE_STATE_ERROR).toBe('CPL-003');
    expect(ControlPlaneErrorCodes.CPL_AGENT_NOT_REGISTERED).toBe('CPL-010');
    expect(ControlPlaneErrorCodes.CPL_AGENT_ALREADY_REGISTERED).toBe('CPL-011');
    expect(ControlPlaneErrorCodes.CPL_AGENT_LIFECYCLE_ERROR).toBe('CPL-012');
    expect(ControlPlaneErrorCodes.CPL_MODE_DETECTION_ERROR).toBe('CPL-020');
    expect(ControlPlaneErrorCodes.CPL_INIT_ERROR).toBe('CPL-030');
  });
});
