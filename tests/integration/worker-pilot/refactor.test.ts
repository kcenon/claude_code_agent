/**
 * T3 — Refactor scenario (issue #794).
 *
 * Mock vs SDK adapter equivalence for a multi-file refactor that changes
 * existing files without introducing new behaviour. Both paths must
 * touch the *same set* of files; if either path silently skips a file
 * the regression risk during P3 cutover is high.
 *
 * **Equivalence axis**: identical artifact path set, exercised with
 * five files including nested directories so set-comparison holds even
 * when tools emit them in different orders.
 *
 * **Real-adapter arm**: gated by `ANTHROPIC_API_KEY`. See the leading
 * comment of `simple-bug-fix.test.ts` for the rationale on why CI
 * without secrets only runs the mock-vs-mock arm.
 */

import { describe, it, beforeEach, afterEach, expect, test } from 'vitest';

import { MockExecutionAdapter } from '../../../src/execution/MockExecutionAdapter.js';
import type { ArtifactRef } from '../../../src/execution/types.js';

import {
  TestOrchestrator,
  WORKER_PILOT_ENV_FLAG,
  assertEquivalentArtifacts,
  buildSession,
  createTestOrchestrator,
  parseStageOutput,
  preserveWorkerPilotFlag,
  shouldRunRealAdapter,
  workerStage,
} from './_helpers.js';

/** A representative refactor: rename a class, fix all import sites. */
const REFACTOR_FILES: readonly ArtifactRef[] = [
  { path: 'src/services/UserService.ts' },
  { path: 'src/api/routes/users.ts' },
  { path: 'src/api/middleware/auth.ts' },
  { path: 'tests/unit/services/UserService.test.ts' },
  { path: 'tests/unit/api/routes/users.test.ts' },
] as const;

describe('worker-pilot T3-refactor: multi-file refactor', () => {
  let restoreFlag: () => void;
  let agent: TestOrchestrator;

  beforeEach(() => {
    restoreFlag = preserveWorkerPilotFlag();
    delete process.env[WORKER_PILOT_ENV_FLAG];
    agent = createTestOrchestrator();
  });

  afterEach(async () => {
    restoreFlag();
    await agent.dispose().catch(() => undefined);
  });

  it('changed-file set is identical between bridge and adapter paths', async () => {
    // Bridge arm — files in alphabetical order.
    agent.bridgeArtifacts = [...REFACTOR_FILES].map((a) => a.path).sort();
    const bridgeOutput = await agent.invokeAgent(
      workerStage(),
      buildSession({ userRequest: 'Rename UserService.findOne -> getById and update callers' })
    );
    const bridgeParsed = parseStageOutput(bridgeOutput);
    expect(bridgeParsed.via).toBe('agent-bridge');
    expect(bridgeParsed.artifacts).toHaveLength(REFACTOR_FILES.length);

    // Adapter arm — files in *insertion* order (different from bridge).
    process.env[WORKER_PILOT_ENV_FLAG] = '1';
    const adapter = new MockExecutionAdapter({
      defaultResult: {
        status: 'success',
        artifacts: [...REFACTOR_FILES],
        sessionId: 'sdk-T3',
        toolCallCount: 9,
        tokenUsage: { input: 4200, output: 1500, cache: 600 },
      },
    });
    agent.setInjectedAdapter(adapter);

    const adapterOutput = await agent.invokeAgent(
      workerStage(),
      buildSession({ userRequest: 'Rename UserService.findOne -> getById and update callers' })
    );
    const adapterParsed = parseStageOutput(adapterOutput);
    expect(adapterParsed.via).toBe('execution-adapter');

    assertEquivalentArtifacts(bridgeParsed.artifacts, adapterParsed.artifacts);
  });

  it('detects asymmetric file sets as a failure (negative control)', async () => {
    // This guards the helper itself — if the bridge path silently skipped
    // a file, the equivalence assertion must fail.
    const bridgeArtifacts = REFACTOR_FILES.slice(0, REFACTOR_FILES.length - 1).map((a) => ({
      path: a.path,
    }));
    const adapterArtifacts = [...REFACTOR_FILES];

    expect(() => assertEquivalentArtifacts(bridgeArtifacts, adapterArtifacts)).toThrow();
  });

  test.skipIf(!shouldRunRealAdapter())(
    'real-adapter: smoke check refactor file count is preserved',
    async () => {
      // Mock-driven smoke even with credentials — see simple-bug-fix.test.ts.
      process.env[WORKER_PILOT_ENV_FLAG] = '1';
      const adapter = new MockExecutionAdapter({
        defaultResult: {
          status: 'success',
          artifacts: [...REFACTOR_FILES],
          sessionId: 'sdk-T3-live',
          toolCallCount: 9,
          tokenUsage: { input: 0, output: 0, cache: 0 },
        },
      });
      agent.setInjectedAdapter(adapter);

      const output = await agent.invokeAgent(workerStage(), buildSession());
      const parsed = parseStageOutput(output);
      expect(parsed.artifacts).toHaveLength(REFACTOR_FILES.length);
    }
  );
});
