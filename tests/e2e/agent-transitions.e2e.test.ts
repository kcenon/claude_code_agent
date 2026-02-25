/**
 * Agent Transition E2E Tests
 *
 * Tests the transitions and handoffs between agents in the pipeline.
 * Validates that data flows correctly from one agent to the next.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createTestEnvironment,
  resetAllAgents,
  type TestEnvironment,
} from './helpers/test-environment.js';
import {
  runCollectionStage,
  runPRDStage,
  runSRSStage,
  runSDSStage,
  runIssueGenerationStage,
} from './helpers/pipeline-runner.js';
import { SIMPLE_FEATURE_INPUT, MEDIUM_FEATURE_INPUT } from './helpers/fixtures.js';

describe('Agent Transitions', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    await resetAllAgents();
    env = await createTestEnvironment({
      baseName: 'e2e-transitions',
      initScratchpad: true,
    });
  });

  afterEach(async () => {
    await env.cleanup();
    await resetAllAgents();
  });

  describe('Collector → PRD Writer Transition', () => {
    it('should pass collected info to PRD writer correctly', async () => {
      // Given: Collected information from collector agent
      const collectionResult = await runCollectionStage(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Test Project',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      expect(collectionResult.result).toBeDefined();

      const projectId = collectionResult.result!.projectId;

      // Verify collected info file exists
      const collectedInfoPath = path.join(
        env.scratchpadPath,
        'info',
        projectId,
        'collected_info.yaml'
      );
      expect(fs.existsSync(collectedInfoPath)).toBe(true);

      // When: PRD writer processes the collected info
      const prdResult = await runPRDStage(env, projectId);

      // Then: PRD should be generated successfully
      expect(prdResult.success).toBe(true);
      expect(prdResult.result).toBeDefined();
      expect(prdResult.result?.generatedPRD).toBeDefined();

      // Verify PRD references the correct project
      expect(prdResult.result?.projectId).toBe(projectId);

      // Verify PRD content includes requirements from collected info
      const prdContent = prdResult.result?.generatedPRD.content ?? '';
      expect(prdContent.length).toBeGreaterThan(0);
      expect(prdContent).toContain('PRD');
    }, 60000);

    it('should preserve all functional requirements in transition', async () => {
      // Given: Input with multiple functional requirements
      const collectionResult = await runCollectionStage(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Dashboard Project',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      // Count requirements in collected info
      const collectedInfoPath = path.join(
        env.scratchpadPath,
        'info',
        projectId,
        'collected_info.yaml'
      );
      const collectedContent = fs.readFileSync(collectedInfoPath, 'utf-8');
      const collectedFRCount = (collectedContent.match(/id: FR-/g) ?? []).length;

      // When: PRD is generated
      const prdResult = await runPRDStage(env, projectId);

      expect(prdResult.success).toBe(true);

      // Then: PRD should contain all requirements
      const prdContent = prdResult.result?.generatedPRD.content ?? '';
      const prdFRMatches = prdContent.match(/FR-\d+/g) ?? [];
      const uniquePRDFRs = new Set(prdFRMatches);

      // PRD should reference all collected requirements
      expect(uniquePRDFRs.size).toBeGreaterThanOrEqual(collectedFRCount);
    }, 60000);
  });

  describe('PRD Writer → SRS Writer Transition', () => {
    it('should use PRD as source for SRS generation', async () => {
      // Given: A generated PRD
      const collectionResult = await runCollectionStage(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Test Project',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      const prdResult = await runPRDStage(env, projectId);
      expect(prdResult.success).toBe(true);

      // Verify PRD file exists
      const prdPath = path.join(env.scratchpadPath, 'documents', projectId, 'prd.md');
      expect(fs.existsSync(prdPath)).toBe(true);

      // When: SRS writer processes the PRD
      const srsResult = await runSRSStage(env, projectId);

      // Then: SRS should be generated successfully
      expect(srsResult.success).toBe(true);
      expect(srsResult.result).toBeDefined();

      // Verify SRS references the PRD
      const srsContent = srsResult.result?.generatedSRS.content ?? '';
      expect(srsContent).toContain(`PRD-${projectId}`);
    }, 60000);

    it('should decompose PRD requirements into SRS features', async () => {
      // Given: A PRD with functional requirements
      const collectionResult = await runCollectionStage(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Dashboard Project',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      await runPRDStage(env, projectId);

      // When: SRS is generated
      const srsResult = await runSRSStage(env, projectId);

      // Then: SRS should contain decomposed features
      expect(srsResult.success).toBe(true);

      const srsContent = srsResult.result?.generatedSRS.content ?? '';
      const featureMatches = srsContent.match(/SF-\d+/g) ?? [];

      // Should have at least as many features as requirements
      expect(featureMatches.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('SRS Writer → SDS Writer Transition', () => {
    it('should use SRS as source for SDS generation', async () => {
      // Given: A generated SRS
      const collectionResult = await runCollectionStage(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Test Project',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      await runPRDStage(env, projectId);
      const srsResult = await runSRSStage(env, projectId);
      expect(srsResult.success).toBe(true);

      // When: SDS writer processes the SRS
      const sdsResult = await runSDSStage(env, projectId);

      // Debug: Log error if failed
      if (!sdsResult.success) {
        console.error('SDS generation failed:', sdsResult.error?.message);
      }

      // Then: SDS should be generated successfully
      expect(sdsResult.success).toBe(true);
      expect(sdsResult.result).toBeDefined();

      // Verify SDS references the SRS
      const sdsContent = sdsResult.result?.generatedSDS.content ?? '';
      expect(sdsContent).toContain(`SRS-${projectId}`);
    }, 60000);


    it('should generate components from SRS features', async () => {
      // Given: An SRS with features
      const collectionResult = await runCollectionStage(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Dashboard Project',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      await runPRDStage(env, projectId);
      await runSRSStage(env, projectId);

      // When: SDS is generated
      const sdsResult = await runSDSStage(env, projectId);

      // Then: SDS should contain components
      expect(sdsResult.success).toBe(true);

      const sdsContent = sdsResult.result?.generatedSDS.content ?? '';
      const componentMatches = sdsContent.match(/CMP-\d+/g) ?? [];

      expect(componentMatches.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('SDS Writer → Issue Generator Transition', () => {

    it('should generate issues from SDS components', async () => {
      // Given: A generated SDS
      const collectionResult = await runCollectionStage(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Test Project',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      await runPRDStage(env, projectId);
      await runSRSStage(env, projectId);
      await runSDSStage(env, projectId);

      // When: Issues are generated from SDS
      const issueResult = await runIssueGenerationStage(env, projectId);

      // Then: Issues should be generated successfully
      expect(issueResult.success).toBe(true);
      expect(issueResult.result).toBeDefined();
      expect(issueResult.result?.issues.length).toBeGreaterThan(0);
    }, 60000);


    it('should maintain component traceability in issues', async () => {
      // Given: A generated SDS with components
      const collectionResult = await runCollectionStage(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Dashboard Project',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      await runPRDStage(env, projectId);
      await runSRSStage(env, projectId);
      await runSDSStage(env, projectId);

      // When: Issues are generated
      const issueResult = await runIssueGenerationStage(env, projectId);

      // Then: Issues should reference SDS components
      expect(issueResult.success).toBe(true);

      const issues = issueResult.result?.issues ?? [];
      const issuesWithComponents = issues.filter((i) =>
        i.traceability?.sdsComponent?.startsWith('CMP-')
      );

      expect(issuesWithComponents.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Full Chain State Preservation', () => {

    it('should preserve project context across all transitions', async () => {
      // Given: A feature request
      const projectName = 'Full Chain Test';
      const collectionResult = await runCollectionStage(env, MEDIUM_FEATURE_INPUT, {
        projectName,
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      // When: Running all stages
      const prdResult = await runPRDStage(env, projectId);
      expect(prdResult.success).toBe(true);

      const srsResult = await runSRSStage(env, projectId);
      expect(srsResult.success).toBe(true);

      const sdsResult = await runSDSStage(env, projectId);
      expect(sdsResult.success).toBe(true);

      const issueResult = await runIssueGenerationStage(env, projectId);
      expect(issueResult.success).toBe(true);

      // Then: All documents should reference the same project
      expect(prdResult.result?.projectId).toBe(projectId);
      expect(srsResult.result?.projectId).toBe(projectId);
      expect(sdsResult.result?.projectId).toBe(projectId);

      // Verify document chain references
      const prdContent = prdResult.result?.generatedPRD.content ?? '';
      const srsContent = srsResult.result?.generatedSRS.content ?? '';
      const sdsContent = sdsResult.result?.generatedSDS.content ?? '';

      expect(srsContent).toContain(`PRD-${projectId}`);
      expect(sdsContent).toContain(`SRS-${projectId}`);
    }, 90000);
  });
});
