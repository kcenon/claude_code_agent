/**
 * Local mode pipeline adaptation tests
 *
 * Tests that adaptStagesForLocalMode correctly transforms pipeline stages
 * for GitHub-free operation.
 */

import { describe, it, expect } from 'vitest';
import {
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
} from '../../src/ad-sdlc-orchestrator/types.js';
import type { PipelineStageDefinition, StageName } from '../../src/ad-sdlc-orchestrator/types.js';

/**
 * Replicate the private adaptStagesForLocalMode logic for testing.
 * This mirrors AdsdlcOrchestratorAgent.adaptStagesForLocalMode exactly.
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

describe('adaptStagesForLocalMode', () => {
  describe('greenfield pipeline', () => {
    const localStages = adaptStagesForLocalMode(GREENFIELD_STAGES);

    it('should remove github_repo_setup stage', () => {
      const stageNames = localStages.map((s) => s.name);
      expect(stageNames).not.toContain('github_repo_setup');
    });

    it('should have one fewer stage than original', () => {
      expect(localStages.length).toBe(GREENFIELD_STAGES.length - 1);
    });

    it('should rewire sds_generation to depend on repo_detection', () => {
      const sdsStage = localStages.find((s) => s.name === 'sds_generation');
      expect(sdsStage).toBeDefined();
      expect(sdsStage!.dependsOn).toContain('repo_detection');
      expect(sdsStage!.dependsOn).not.toContain('github_repo_setup');
    });

    it('should replace pr-reviewer with local-reviewer', () => {
      const reviewStage = localStages.find((s) => s.name === 'review');
      expect(reviewStage).toBeDefined();
      expect(reviewStage!.agentType).toBe('local-reviewer');
    });

    it('should preserve all other stages', () => {
      const preserved = [
        'initialization',
        'mode_detection',
        'collection',
        'prd_generation',
        'srs_generation',
        'repo_detection',
        'sds_generation',
        'issue_generation',
        'orchestration',
        'implementation',
        'validation-agent',
        'review',
      ];
      const stageNames = localStages.map((s) => s.name);
      for (const name of preserved) {
        expect(stageNames).toContain(name);
      }
    });

    it('should have no orphan dependencies', () => {
      const stageNames = new Set(localStages.map((s) => s.name));
      for (const stage of localStages) {
        for (const dep of stage.dependsOn) {
          expect(stageNames.has(dep)).toBe(true);
        }
      }
    });
  });

  describe('enhancement pipeline', () => {
    const localStages = adaptStagesForLocalMode(ENHANCEMENT_STAGES);

    it('should have same number of stages (no github_repo_setup to remove)', () => {
      expect(localStages.length).toBe(ENHANCEMENT_STAGES.length);
    });

    it('should replace pr-reviewer with local-reviewer', () => {
      const reviewStage = localStages.find((s) => s.name === 'review');
      expect(reviewStage).toBeDefined();
      expect(reviewStage!.agentType).toBe('local-reviewer');
    });

    it('should not modify non-GitHub agent types', () => {
      const collector = localStages.find((s) => s.agentType === 'doc-code-comparator');
      expect(collector).toBeDefined();
    });
  });

  describe('import pipeline', () => {
    const localStages = adaptStagesForLocalMode(IMPORT_STAGES);

    it('should replace issue-reader with local-issue-reader', () => {
      const readStage = localStages.find((s) => s.name === 'issue_reading');
      expect(readStage).toBeDefined();
      expect(readStage!.agentType).toBe('local-issue-reader');
    });

    it('should replace pr-reviewer with local-reviewer', () => {
      const reviewStage = localStages.find((s) => s.name === 'review');
      expect(reviewStage).toBeDefined();
      expect(reviewStage!.agentType).toBe('local-reviewer');
    });

    it('should have same number of stages (no github_repo_setup)', () => {
      expect(localStages.length).toBe(IMPORT_STAGES.length);
    });

    it('should have no orphan dependencies', () => {
      const stageNames = new Set(localStages.map((s) => s.name));
      for (const stage of localStages) {
        for (const dep of stage.dependsOn) {
          expect(stageNames.has(dep)).toBe(true);
        }
      }
    });
  });
});

describe('getRequiredSecrets', () => {
  it('should return only ANTHROPIC_API_KEY in local mode', async () => {
    const { getRequiredSecrets } = await import('../../src/security/SecretManager.js');
    const secrets = getRequiredSecrets(true);
    expect(secrets).toContain('ANTHROPIC_API_KEY');
    expect(secrets).not.toContain('GITHUB_TOKEN');
  });

  it('should return both secrets in GitHub mode', async () => {
    const { getRequiredSecrets } = await import('../../src/security/SecretManager.js');
    const secrets = getRequiredSecrets(false);
    expect(secrets).toContain('ANTHROPIC_API_KEY');
    expect(secrets).toContain('GITHUB_TOKEN');
  });
});
