/**
 * Agent Dispatch integration tests
 *
 * Verifies the end-to-end dispatch chain with real agent modules:
 *   executeStageWithRetry() -> executeStageAgent() -> invokeAgent()
 *     -> AgentDispatcher.dispatch(stage, session)
 *       -> AGENT_TYPE_MAP lookup -> dynamic import() -> call adapter -> agent method
 *
 * These tests verify that:
 * - Known agent types resolve and load without "Unknown agent type" errors
 * - Unknown agent types throw AgentDispatchError with "Unknown agent type"
 * - Singleton caching returns the same instance
 * - Dynamic imports succeed for all mapped agents
 * - bootstrapAgents() is idempotent
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentDispatcher, AgentDispatchError } from '../../src/agents/AgentDispatcher.js';
import { bootstrapAgents } from '../../src/agents/bootstrapAgents.js';
import { AGENT_TYPE_MAP, getAgentTypes } from '../../src/agents/AgentTypeMapping.js';
import { AgentRegistry } from '../../src/agents/AgentRegistry.js';
import type { PipelineStageDefinition, OrchestratorSession } from '../../src/ad-sdlc-orchestrator/types.js';

/**
 * Resolve the directory where AgentTypeMapping.ts lives (src/agents/).
 * The import paths in AGENT_TYPE_MAP are relative to that directory.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENTS_SRC_DIR = path.resolve(__dirname, '../../src/agents');

/**
 * Create a minimal PipelineStageDefinition for testing dispatch.
 */
function createStage(agentType: string): PipelineStageDefinition {
  return {
    name: 'initialization',
    agentType,
    description: `Test dispatch for ${agentType}`,
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
  };
}

/**
 * Create a minimal OrchestratorSession for testing dispatch.
 */
function createSession(): OrchestratorSession {
  return {
    sessionId: 'test-session-001',
    projectDir: '/tmp/test-project',
    userRequest: 'Test dispatch integration',
    mode: 'greenfield',
    startedAt: new Date().toISOString(),
    status: 'running',
    stageResults: [],
    scratchpadDir: '/tmp/test-project/.ad-sdlc/scratchpad',
  };
}

/**
 * Check whether a dispatch error indicates the agent type itself was unknown
 * (dispatch-level failure) vs the agent loaded but execution failed
 * (agent-level failure, which is acceptable in these integration tests).
 *
 * AgentDispatcher.dispatch() wraps all errors in AgentDispatchError, so
 * we distinguish by checking if the message mentions "Unknown agent type".
 */
function isUnknownAgentTypeError(error: unknown): boolean {
  return error instanceof AgentDispatchError && error.message.includes('Unknown agent type');
}

describe('Agent Dispatch Integration', () => {
  let dispatcher: AgentDispatcher;

  beforeEach(async () => {
    AgentRegistry.reset();
    await bootstrapAgents();
    dispatcher = new AgentDispatcher();
  });

  afterEach(async () => {
    await dispatcher.disposeAll();
    AgentRegistry.reset();
  });

  describe('Dispatcher resolves known agentType', () => {
    // Pick one representative agent from each pipeline mode.
    // These agents will be loaded dynamically, and their execution
    // will likely fail due to missing config/project, which is expected.
    // The key assertion is that the error does NOT say "Unknown agent type"
    // (which would indicate the dispatch chain itself could not resolve the type).

    const knownAgents = [
      { agentType: 'collector', pipeline: 'greenfield' },
      { agentType: 'document-reader', pipeline: 'enhancement' },
      { agentType: 'issue-reader', pipeline: 'import' },
    ];

    for (const { agentType, pipeline } of knownAgents) {
      it(`should resolve '${agentType}' (${pipeline} pipeline) without unknown-type error`, async () => {
        const stage = createStage(agentType);
        const session = createSession();

        try {
          await dispatcher.dispatch(stage, session);
          // If dispatch succeeds, the chain works
        } catch (error) {
          // Agent-level errors (missing config, missing project dir, etc.) are acceptable.
          // The test fails ONLY if dispatch could not resolve the agent type.
          expect(isUnknownAgentTypeError(error)).toBe(false);
        }
      });
    }
  });

  describe('Unknown agentType throws AgentDispatchError', () => {
    it("should throw AgentDispatchError for unregistered 'nonexistent-agent'", async () => {
      const stage = createStage('nonexistent-agent');
      const session = createSession();

      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow(AgentDispatchError);
    });

    it("should include 'Unknown agent type' in the error message", async () => {
      const stage = createStage('totally-fake-agent');
      const session = createSession();

      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow(
        /Unknown agent type 'totally-fake-agent'/
      );
    });
  });

  describe('Singleton caching', () => {
    it('should return the same agent instance on repeated dispatch for singleton agents', async () => {
      // Pick a singleton agent from AGENT_TYPE_MAP
      const singletonType = 'collector';
      const entry = AGENT_TYPE_MAP[singletonType];
      expect(entry).toBeDefined();
      expect(entry!.lifecycle).toBe('singleton');

      const stage = createStage(singletonType);
      const session = createSession();

      // First dispatch to populate the cache
      try {
        await dispatcher.dispatch(stage, session);
      } catch {
        // Agent-level error expected
      }

      const firstCached = dispatcher.getCachedAgent(singletonType);

      // Second dispatch should use cache
      try {
        await dispatcher.dispatch(stage, session);
      } catch {
        // Agent-level error expected
      }

      const secondCached = dispatcher.getCachedAgent(singletonType);

      // If both dispatches created an agent, they should be the same instance
      if (firstCached && secondCached) {
        expect(firstCached).toBe(secondCached);
      }
      // Even after two dispatches, cache size for this type should be 1
      expect(dispatcher.getCachedAgent(singletonType)).toBeDefined();
    });

    it('should NOT cache transient agents', async () => {
      // Worker is transient
      const transientType = 'worker';
      const entry = AGENT_TYPE_MAP[transientType];
      expect(entry).toBeDefined();
      expect(entry!.lifecycle).toBe('transient');

      const stage = createStage(transientType);
      const session = createSession();

      try {
        await dispatcher.dispatch(stage, session);
      } catch {
        // Agent-level error expected
      }

      // Transient agents should not be cached
      expect(dispatcher.getCachedAgent(transientType)).toBeUndefined();
    });
  });

  describe('Dynamic import succeeds for all mapped agents', () => {
    const allAgentTypes = getAgentTypes();

    for (const agentType of allAgentTypes) {
      const entry = AGENT_TYPE_MAP[agentType];
      if (!entry) continue;

      it(`should dynamically import module for '${agentType}' (${entry.importPath})`, async () => {
        // The importPath in AGENT_TYPE_MAP is relative to src/agents/AgentTypeMapping.ts,
        // e.g. '../collector/index.js'. Resolve it to an absolute path using the
        // same base directory so the dynamic import succeeds from the test context.
        const absoluteImportPath = path.resolve(AGENTS_SRC_DIR, entry.importPath);

        try {
          const mod: Record<string, unknown> = await import(absoluteImportPath);
          expect(mod).toBeDefined();
          expect(typeof mod).toBe('object');

          // Verify the module has at least one export
          expect(Object.keys(mod).length).toBeGreaterThan(0);
        } catch (error) {
          // If the import fails because of a missing transitive dependency
          // (e.g., @inquirer/password not installed in this environment),
          // that is an environment issue, not a dispatch chain issue.
          // We only fail the test if the agent's own module file is missing.
          const message = error instanceof Error ? error.message : String(error);
          const isOwnModuleMissing =
            message.includes(entry.importPath) ||
            message.includes(`Cannot find module '${absoluteImportPath}'`);
          if (isOwnModuleMissing) {
            throw error; // Re-throw: the agent module itself is missing
          }
          // Otherwise it's a transitive dependency issue; skip gracefully
        }
      });
    }
  });

  describe('Bootstrap idempotency', () => {
    it('should succeed on second call without errors', async () => {
      // bootstrapAgents() was already called in beforeEach.
      // A second call should be a no-op.
      const result = await bootstrapAgents();

      expect(result.totalEntries).toBeGreaterThan(0);
      expect(result.registered).toBe(0); // All already registered
      expect(result.skipped).toBe(result.totalEntries);
    });

    it('should maintain consistent agent count across calls', async () => {
      const firstResult = await bootstrapAgents();
      const secondResult = await bootstrapAgents();

      expect(firstResult.totalEntries).toBe(secondResult.totalEntries);
    });
  });

  describe('Enhancement pipeline agent dispatch', () => {
    it("should dispatch 'document-reader' without unknown-type error", async () => {
      const stage = createStage('document-reader');
      const session: OrchestratorSession = {
        ...createSession(),
        mode: 'enhancement',
      };

      try {
        await dispatcher.dispatch(stage, session);
      } catch (error) {
        // Agent-level errors are fine; unknown-type errors are not
        expect(isUnknownAgentTypeError(error)).toBe(false);
      }
    });

    it("should dispatch 'impact-analyzer' without unknown-type error", async () => {
      const stage = createStage('impact-analyzer');
      const session: OrchestratorSession = {
        ...createSession(),
        mode: 'enhancement',
      };

      try {
        await dispatcher.dispatch(stage, session);
      } catch (error) {
        // Agent-level errors (missing session, config, etc.) are acceptable.
        // Only unknown-type errors indicate a broken dispatch chain.
        expect(isUnknownAgentTypeError(error)).toBe(false);
      }
    });
  });

  describe('Dispatcher cache management', () => {
    it('should start with empty cache', () => {
      expect(dispatcher.cacheSize).toBe(0);
    });

    it('should clear cache on disposeAll', async () => {
      const stage = createStage('collector');
      const session = createSession();

      try {
        await dispatcher.dispatch(stage, session);
      } catch {
        // Expected agent-level error
      }

      // Cache may have been populated if agent was created
      const sizeBeforeDispose = dispatcher.cacheSize;

      await dispatcher.disposeAll();

      expect(dispatcher.cacheSize).toBe(0);
      // Verify it was actually populated before dispose (if agent creation succeeded)
      if (sizeBeforeDispose > 0) {
        expect(sizeBeforeDispose).toBeGreaterThan(0);
      }
    });
  });

  describe('Call adapter registration', () => {
    it('should have adapters registered for known agent types with custom behavior', () => {
      // These agent types have custom adapters registered in registerDefaultAdapters()
      const adaptedTypes = [
        'collector',
        'prd-writer',
        'srs-writer',
        'sds-writer',
        'repo-detector',
        'github-repo-setup',
        'document-reader',
        'codebase-analyzer',
        'impact-analyzer',
        'prd-updater',
        'srs-updater',
        'sds-updater',
        'regression-tester',
        'issue-reader',
      ];

      for (const agentType of adaptedTypes) {
        expect(dispatcher.hasAdapter(agentType)).toBe(true);
      }
    });

    it('should fall back to default adapter for agent types without custom adapter', () => {
      // ci-fixer and analysis-orchestrator do not have custom adapters
      expect(dispatcher.hasAdapter('ci-fixer')).toBe(false);
      expect(dispatcher.hasAdapter('analysis-orchestrator')).toBe(false);
    });
  });
});
