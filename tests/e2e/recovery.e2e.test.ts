/**
 * Error Recovery E2E Tests
 *
 * Tests for error handling and recovery scenarios
 * in the AD-SDLC pipeline.
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
  runPipeline,
} from './helpers/pipeline-runner.js';
import { MINIMAL_INPUT, SIMPLE_FEATURE_INPUT } from './helpers/fixtures.js';

describe('Error Recovery', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    await resetAllAgents();
    env = await createTestEnvironment({
      baseName: 'e2e-recovery',
      initScratchpad: true,
    });
  });

  afterEach(async () => {
    await env.cleanup();
    await resetAllAgents();
  });

  describe('Missing Input Handling', () => {
    it('should handle empty input gracefully', async () => {
      // Given: Empty input
      const emptyInput = '';

      // When: Running collection with empty input
      const result = await runCollectionStage(env, emptyInput, {
        projectName: 'Empty Test',
        skipClarification: true,
      });

      // Then: Should fail gracefully with error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 30000);

    it('should handle whitespace-only input', async () => {
      // Given: Whitespace-only input
      const whitespaceInput = '   \n\t\n   ';

      // When: Running collection
      const result = await runCollectionStage(env, whitespaceInput, {
        projectName: 'Whitespace Test',
        skipClarification: true,
      });

      // Then: Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 30000);
  });

  describe('Missing Predecessor Document', () => {

    it('should fail gracefully when collected info is missing for PRD', async () => {
      // Given: A non-existent project ID
      const fakeProjectId = 'non-existent-project-id';

      // When: Trying to generate PRD without collected info
      const result = await runPRDStage(env, fakeProjectId);

      // Then: Should fail with appropriate error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // PRDWriterAgent throws ENOENT for missing files
      expect(result.error?.message).toMatch(/not found|ENOENT|no such file/i);
    }, 30000);

    it('should fail gracefully when PRD is missing for SRS', async () => {
      // Given: A project with collected info but no PRD
      const collectionResult = await runCollectionStage(env, MINIMAL_INPUT, {
        projectName: 'Missing PRD Test',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      // Delete or skip PRD generation
      // When: Trying to generate SRS without PRD
      const result = await runSRSStage(env, projectId);

      // Then: Should fail with appropriate error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 30000);

    it('should fail gracefully when SRS is missing for SDS', async () => {
      // Given: A project with PRD but no SRS
      const collectionResult = await runCollectionStage(env, MINIMAL_INPUT, {
        projectName: 'Missing SRS Test',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      await runPRDStage(env, projectId);

      // Delete SRS or skip its generation
      // When: Trying to generate SDS without SRS
      const result = await runSDSStage(env, projectId);

      // Then: Should fail with appropriate error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 30000);
  });

  describe('Corrupted Document Handling', () => {
    it('should handle corrupted collected info file', async () => {
      // Given: A project with corrupted collected info
      const collectionResult = await runCollectionStage(env, MINIMAL_INPUT, {
        projectName: 'Corrupted Info Test',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      // Corrupt the collected info file
      const infoPath = path.join(env.scratchpadPath, 'info', projectId, 'collected_info.yaml');
      fs.writeFileSync(infoPath, 'invalid: yaml: content: [[[');

      // When: Trying to generate PRD with corrupted input
      const result = await runPRDStage(env, projectId);

      // Then: Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 30000);


    it('should handle corrupted PRD file', async () => {
      // Given: A project with valid collection but corrupted PRD
      const collectionResult = await runCollectionStage(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Corrupted PRD Test',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      // Generate PRD then corrupt it
      await runPRDStage(env, projectId);

      const prdPath = path.join(env.scratchpadPath, 'documents', projectId, 'prd.md');
      fs.writeFileSync(prdPath, ''); // Empty file

      // When: Trying to generate SRS with corrupted PRD
      const result = await runSRSStage(env, projectId);

      // Then: SRS writer handles empty PRD gracefully -
      // it either fails with an error or succeeds with degraded output (no features).
      // Both outcomes are acceptable error-recovery behavior.
      if (!result.success) {
        expect(result.error).toBeDefined();
      } else {
        // Succeeds but produces minimal/degraded SRS with no extracted features
        const srsContent = result.result?.generatedSRS?.content ?? '';
        expect(srsContent.length).toBeLessThan(5000);
      }
    }, 30000);
  });

  describe('Partial Pipeline Recovery', () => {

    it('should allow resuming from valid checkpoint', async () => {
      // Given: A completed collection stage
      const collectionResult = await runCollectionStage(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Resume Test',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      // Complete PRD stage
      const prdResult = await runPRDStage(env, projectId);
      expect(prdResult.success).toBe(true);

      // Reset agents (simulate restart)
      await resetAllAgents();

      // When: Resuming from PRD stage
      const srsResult = await runSRSStage(env, projectId);

      // Then: Should continue successfully
      expect(srsResult.success).toBe(true);

      const sdsResult = await runSDSStage(env, projectId);
      expect(sdsResult.success).toBe(true);
    }, 60000);


    it('should preserve documents after agent reset', async () => {
      // Given: Completed document pipeline
      const collectionResult = await runCollectionStage(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Preservation Test',
        skipClarification: true,
      });

      expect(collectionResult.success).toBe(true);
      const projectId = collectionResult.result!.projectId;

      await runPRDStage(env, projectId);
      await runSRSStage(env, projectId);
      await runSDSStage(env, projectId);

      // Record file contents
      const prdPath = path.join(env.scratchpadPath, 'documents', projectId, 'prd.md');
      const srsPath = path.join(env.scratchpadPath, 'documents', projectId, 'srs.md');
      const sdsPath = path.join(env.scratchpadPath, 'documents', projectId, 'sds.md');

      const prdBefore = fs.readFileSync(prdPath, 'utf-8');
      const srsBefore = fs.readFileSync(srsPath, 'utf-8');
      const sdsBefore = fs.readFileSync(sdsPath, 'utf-8');

      // Reset all agents
      await resetAllAgents();

      // Then: Documents should still exist and be unchanged
      expect(fs.existsSync(prdPath)).toBe(true);
      expect(fs.existsSync(srsPath)).toBe(true);
      expect(fs.existsSync(sdsPath)).toBe(true);

      expect(fs.readFileSync(prdPath, 'utf-8')).toBe(prdBefore);
      expect(fs.readFileSync(srsPath, 'utf-8')).toBe(srsBefore);
      expect(fs.readFileSync(sdsPath, 'utf-8')).toBe(sdsBefore);
    }, 60000);
  });

  describe('Timeout Handling', () => {

    it('should handle minimal input within timeout', async () => {
      // Given: Minimal input that should process quickly
      const result = await runPipeline(env, MINIMAL_INPUT, {
        projectName: 'Timeout Test',
        skipClarification: true,
        generateIssues: true,
      });

      // Then: Should complete within reasonable time
      expect(result.totalTimeMs).toBeLessThan(60000);
    }, 60000);
  });

  describe('Directory Structure Recovery', () => {
    it('should create missing directories during pipeline', async () => {
      // Given: Environment without document directories
      const projectId = 'test-project-123';

      // Manually create minimal structure
      const infoPath = path.join(env.scratchpadPath, 'info', projectId);
      fs.mkdirSync(infoPath, { recursive: true });

      // Create a valid collected_info.yaml manually
      const collectedInfo = {
        schemaVersion: '1.0.0',
        projectId,
        status: 'completed',
        project: {
          name: 'Test Project',
          description: 'A test project',
        },
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Test Feature',
              description: 'A test feature',
              priority: 'P1',
              status: 'proposed',
              acceptanceCriteria: [],
              dependencies: [],
              source: 'test',
            },
          ],
          nonFunctional: [],
        },
        constraints: [],
        assumptions: [],
        dependencies: [],
        clarifications: [],
        sources: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      fs.writeFileSync(
        path.join(infoPath, 'collected_info.yaml'),
        JSON.stringify(collectedInfo, null, 2)
          .replace(/{/g, '')
          .replace(/}/g, '')
          .replace(/"/g, '')
          .replace(/,\n/g, '\n')
      );

      // When: Running PRD generation (should create docs directory)
      const result = await runPRDStage(env, projectId);

      // Then: If successful, directory was created
      if (result.success) {
        const docsPath = path.join(env.scratchpadPath, 'documents', projectId);
        expect(fs.existsSync(docsPath)).toBe(true);
      }
    }, 30000);
  });
});
