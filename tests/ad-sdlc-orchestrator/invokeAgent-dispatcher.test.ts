/**
 * Tests for invokeAgent() wiring to AgentDispatcher
 *
 * Verifies that the orchestrator's invokeAgent() method delegates to
 * AgentDispatcher.dispatch() and that the dispatcher is lazily initialized
 * with bootstrapAgents() called exactly once.
 *
 * Issue: #523
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import type {
  OrchestratorSession,
  PipelineStageDefinition,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { AgentDispatcher } from '../../src/agents/AgentDispatcher.js';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal stage definition for testing invokeAgent()
 */
function createStage(overrides?: Partial<PipelineStageDefinition>): PipelineStageDefinition {
  return {
    name: 'collection',
    agentType: 'collector',
    description: 'Test stage',
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
    ...overrides,
  };
}

/**
 * Minimal orchestrator session for testing
 */
function createSession(projectDir: string): OrchestratorSession {
  return {
    sessionId: 'test-session-id',
    projectDir,
    userRequest: 'Build a web app',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: path.join(projectDir, '.ad-sdlc', 'scratchpad'),
  };
}

/**
 * Test subclass that exposes the protected invokeAgent method and
 * provides access to the internal _dispatcher field.
 */
class TestableOrchestrator extends AdsdlcOrchestratorAgent {
  /**
   * Public wrapper around the protected invokeAgent method.
   */
  async callInvokeAgent(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<string> {
    return this.invokeAgent(stage, session);
  }

  /**
   * Access the private _dispatcher field for assertions.
   */
  getInternalDispatcher(): AgentDispatcher | null {
    return (this as unknown as { _dispatcher: AgentDispatcher | null })._dispatcher;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('invokeAgent() dispatcher wiring', () => {
  let tempDir: string;
  let orchestrator: TestableOrchestrator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'invoke-agent-test-'));
    orchestrator = new TestableOrchestrator();
  });

  afterEach(async () => {
    await orchestrator.dispose();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('lazy initialization', () => {
    it('should not create dispatcher before first invokeAgent call', () => {
      expect(orchestrator.getInternalDispatcher()).toBeNull();
    });

    it('should create dispatcher on first invokeAgent call', async () => {
      const stage = createStage();
      const session = createSession(tempDir);

      // invokeAgent will create the dispatcher and attempt to dispatch.
      // The dispatch will likely fail (agent modules may not be available),
      // but the dispatcher should be created.
      try {
        await orchestrator.callInvokeAgent(stage, session);
      } catch {
        // Expected: dispatch may fail due to agent module unavailability
      }

      expect(orchestrator.getInternalDispatcher()).not.toBeNull();
      expect(orchestrator.getInternalDispatcher()).toBeInstanceOf(AgentDispatcher);
    });

    it('should reuse the same dispatcher across multiple calls', async () => {
      const stage = createStage();
      const session = createSession(tempDir);

      try {
        await orchestrator.callInvokeAgent(stage, session);
      } catch {
        // Expected
      }

      const firstDispatcher = orchestrator.getInternalDispatcher();

      try {
        await orchestrator.callInvokeAgent(stage, session);
      } catch {
        // Expected
      }

      const secondDispatcher = orchestrator.getInternalDispatcher();
      expect(firstDispatcher).toBe(secondDispatcher);
    });
  });

  describe('bootstrapAgents idempotency', () => {
    it('should call bootstrapAgents before creating dispatcher', async () => {
      const bootstrapSpy = vi.fn().mockResolvedValue({
        totalEntries: 0,
        registered: 0,
        skipped: 0,
      });

      // Mock bootstrapAgents at the module level
      const bootstrapModule = await import('../../src/agents/bootstrapAgents.js');
      const originalBootstrap = bootstrapModule.bootstrapAgents;

      // Replace with spy
      vi.spyOn(bootstrapModule, 'bootstrapAgents').mockImplementation(bootstrapSpy);

      try {
        const stage = createStage();
        const session = createSession(tempDir);

        try {
          await orchestrator.callInvokeAgent(stage, session);
        } catch {
          // Expected: dispatch may fail
        }

        expect(bootstrapSpy).toHaveBeenCalledTimes(1);

        // Second call should NOT call bootstrapAgents again
        try {
          await orchestrator.callInvokeAgent(stage, session);
        } catch {
          // Expected
        }

        expect(bootstrapSpy).toHaveBeenCalledTimes(1);
      } finally {
        // Restore original
        vi.mocked(bootstrapModule.bootstrapAgents).mockImplementation(originalBootstrap);
      }
    });
  });

  describe('dispatch delegation', () => {
    it('should call dispatcher.dispatch with stage and session arguments', async () => {
      const stage = createStage();
      const session = createSession(tempDir);

      // Create orchestrator, force-create dispatcher, then spy on dispatch
      try {
        await orchestrator.callInvokeAgent(stage, session);
      } catch {
        // Expected: first call creates dispatcher
      }

      const dispatcher = orchestrator.getInternalDispatcher()!;
      const dispatchSpy = vi.spyOn(dispatcher, 'dispatch').mockResolvedValue('mock output');

      const result = await orchestrator.callInvokeAgent(stage, session);

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(stage, session);
      expect(result).toBe('mock output');
    });

    it('should propagate errors from dispatcher.dispatch', async () => {
      const stage = createStage();
      const session = createSession(tempDir);

      // Create orchestrator, force-create dispatcher, then mock dispatch to throw
      try {
        await orchestrator.callInvokeAgent(stage, session);
      } catch {
        // Expected
      }

      const dispatcher = orchestrator.getInternalDispatcher()!;
      vi.spyOn(dispatcher, 'dispatch').mockRejectedValue(
        new Error('Agent execution failed')
      );

      await expect(orchestrator.callInvokeAgent(stage, session)).rejects.toThrow(
        'Agent execution failed'
      );
    });
  });

  describe('dispose cleanup', () => {
    it('should dispose the dispatcher when orchestrator is disposed', async () => {
      const stage = createStage();
      const session = createSession(tempDir);

      // Force dispatcher creation
      try {
        await orchestrator.callInvokeAgent(stage, session);
      } catch {
        // Expected
      }

      const dispatcher = orchestrator.getInternalDispatcher()!;
      const disposeSpy = vi.spyOn(dispatcher, 'disposeAll').mockResolvedValue();

      await orchestrator.dispose();

      expect(disposeSpy).toHaveBeenCalledTimes(1);
      expect(orchestrator.getInternalDispatcher()).toBeNull();
    });

    it('should handle dispose when no dispatcher was created', async () => {
      // No invokeAgent calls, so no dispatcher exists
      expect(orchestrator.getInternalDispatcher()).toBeNull();

      // Should not throw
      await expect(orchestrator.dispose()).resolves.not.toThrow();
    });

    it('should allow re-creation of dispatcher after dispose', async () => {
      const stage = createStage();
      const session = createSession(tempDir);

      // Create dispatcher
      try {
        await orchestrator.callInvokeAgent(stage, session);
      } catch {
        // Expected
      }

      expect(orchestrator.getInternalDispatcher()).not.toBeNull();

      // Dispose (mock disposeAll to avoid real cleanup issues)
      vi.spyOn(orchestrator.getInternalDispatcher()!, 'disposeAll').mockResolvedValue();
      await orchestrator.dispose();
      expect(orchestrator.getInternalDispatcher()).toBeNull();

      // Re-initialize and invoke again should create a new dispatcher
      orchestrator = new TestableOrchestrator();
      try {
        await orchestrator.callInvokeAgent(stage, session);
      } catch {
        // Expected
      }

      expect(orchestrator.getInternalDispatcher()).not.toBeNull();
    });
  });
});
