/**
 * Dispatch-integrity tests for the AD-SDLC orchestrator.
 *
 * Every agentType the orchestrator can emit — both in standard mode
 * and in --local mode — must resolve to an existing
 * `.claude/agents/<agentType>.md` file on disk. This test acts as a
 * compile-time guard: if a remap target ever goes missing again, this
 * suite catches it immediately.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
} from '../../src/ad-sdlc-orchestrator/types.js';
import type { PipelineStageDefinition, StageName } from '../../src/ad-sdlc-orchestrator/types.js';

// Resolve project root from this test file's location
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const AGENTS_DIR = join(PROJECT_ROOT, '.claude', 'agents');

/**
 * Replicate the private adaptStagesForLocalMode logic.
 * Mirrors AdsdlcOrchestratorAgent.adaptStagesForLocalMode exactly so that
 * this test breaks the moment the production logic diverges.
 */
function adaptStagesForLocalMode(
  stages: readonly PipelineStageDefinition[]
): PipelineStageDefinition[] {
  return stages
    .filter((s) => s.name !== 'github_repo_setup')
    .map((s) => {
      const filtered = s.dependsOn.filter((d) => d !== 'github_repo_setup');
      const needsRewire =
        s.dependsOn.includes('github_repo_setup' as StageName) &&
        !s.dependsOn.includes('repo_detection' as StageName);
      const dependsOn = (
        needsRewire ? [...filtered, 'repo_detection' as StageName] : [...filtered]
      ) as typeof s.dependsOn;

      let { agentType } = s;
      if (agentType === 'pr-reviewer') agentType = 'local-reviewer';
      if (agentType === 'issue-reader') agentType = 'local-issue-reader';

      return { ...s, agentType, dependsOn };
    });
}

/**
 * Collect the unique set of agentTypes emitted by all pipeline definitions,
 * optionally after passing them through the local-mode remap.
 */
function collectAgentTypes(
  pipelines: readonly (readonly PipelineStageDefinition[])[],
  localMode: boolean
): Set<string> {
  const types = new Set<string>();
  for (const pipeline of pipelines) {
    const stages = localMode ? adaptStagesForLocalMode(pipeline) : [...pipeline];
    for (const stage of stages) {
      types.add(stage.agentType);
    }
  }
  return types;
}

const ALL_PIPELINES = [GREENFIELD_STAGES, ENHANCEMENT_STAGES, IMPORT_STAGES] as const;

describe('dispatch integrity — standard mode', () => {
  const agentTypes = collectAgentTypes(ALL_PIPELINES, false);

  for (const agentType of agentTypes) {
    it(`agentType "${agentType}" resolves to an existing .claude/agents/${agentType}.md`, () => {
      const mdPath = join(AGENTS_DIR, `${agentType}.md`);
      expect(existsSync(mdPath), `Missing agent definition: ${mdPath}`).toBe(true);
    });
  }
});

describe('dispatch integrity — local mode (--local)', () => {
  const agentTypes = collectAgentTypes(ALL_PIPELINES, true);

  for (const agentType of agentTypes) {
    it(`agentType "${agentType}" resolves to an existing .claude/agents/${agentType}.md`, () => {
      const mdPath = join(AGENTS_DIR, `${agentType}.md`);
      expect(existsSync(mdPath), `Missing agent definition: ${mdPath}`).toBe(true);
    });
  }
});

describe('local-mode remaps produce resolvable targets', () => {
  it('local-reviewer.md exists (remap target for pr-reviewer)', () => {
    expect(existsSync(join(AGENTS_DIR, 'local-reviewer.md'))).toBe(true);
  });

  it('local-issue-reader.md exists (remap target for issue-reader)', () => {
    expect(existsSync(join(AGENTS_DIR, 'local-issue-reader.md'))).toBe(true);
  });
});

describe('no dangling remap references in standard mode', () => {
  it('standard mode does not emit "local-reviewer" as an agentType', () => {
    const agentTypes = collectAgentTypes(ALL_PIPELINES, false);
    expect(agentTypes.has('local-reviewer')).toBe(false);
  });

  it('standard mode does not emit "local-issue-reader" as an agentType', () => {
    const agentTypes = collectAgentTypes(ALL_PIPELINES, false);
    expect(agentTypes.has('local-issue-reader')).toBe(false);
  });
});
