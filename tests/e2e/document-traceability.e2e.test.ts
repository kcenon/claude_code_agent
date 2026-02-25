/**
 * Document Traceability E2E Tests
 *
 * Tests that document generation maintains proper traceability
 * between PRD → SRS → SDS and validates the traceability matrix.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createTestEnvironment,
  resetAllAgents,
  type TestEnvironment,
} from './helpers/test-environment.js';
import { runPipeline } from './helpers/pipeline-runner.js';
import {
  verifyTraceability,
  verifyDocument,
  countRequirements,
} from './helpers/verification.js';
import { MEDIUM_FEATURE_INPUT, COMPLEX_FEATURE_INPUT } from './helpers/fixtures.js';

describe('Document Traceability', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    await resetAllAgents();
    env = await createTestEnvironment({
      baseName: 'e2e-traceability',
      initScratchpad: true,
    });
  });

  afterEach(async () => {
    await env.cleanup();
    await resetAllAgents();
  });

  describe('PRD → SRS Traceability', () => {

    it('should include PRD reference in SRS document', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Traceability Test',
        skipClarification: true,
        generateIssues: false,
      });

      expect(result.success).toBe(true);

      // When: Checking SRS content
      const srsPath = path.join(env.scratchpadPath, 'documents', result.projectId, 'srs.md');
      const srsContent = fs.readFileSync(srsPath, 'utf-8');

      // Then: SRS should reference the PRD
      expect(srsContent).toContain(`PRD-${result.projectId}`);
      expect(srsContent).toContain('Source PRD');
    }, 60000);


    it('should map PRD requirements to SRS features', async () => {
      // Given: A complete pipeline with known requirements
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Requirement Mapping Test',
        skipClarification: true,
        generateIssues: false,
      });

      expect(result.success).toBe(true);

      // When: Analyzing requirement counts
      const counts = countRequirements(env, result.projectId);

      // Then: SRS should have features derived from PRD requirements
      expect(counts.srsFeatures).toBeGreaterThan(0);
      // Features can be more than requirements due to decomposition
      expect(counts.srsFeatures).toBeGreaterThanOrEqual(counts.prdFunctional);
    }, 60000);


    it('should include traceability matrix in SRS', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Matrix Test',
        skipClarification: true,
        generateIssues: false,
      });

      expect(result.success).toBe(true);

      // When: Checking SRS document
      const srsVerification = verifyDocument(env, result.projectId, 'srs');

      // Then: SRS should have traceability information
      expect(srsVerification.exists).toBe(true);
      expect(srsVerification.hasTraceability).toBe(true);
    }, 60000);
  });

  describe('SRS → SDS Traceability', () => {
    it('should include SRS reference in SDS document', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'SRS-SDS Trace Test',
        skipClarification: true,
        generateIssues: false,
      });

      expect(result.success).toBe(true);

      // When: Checking SDS content
      const sdsPath = path.join(env.scratchpadPath, 'documents', result.projectId, 'sds.md');
      const sdsContent = fs.readFileSync(sdsPath, 'utf-8');

      // Then: SDS should reference the SRS
      expect(sdsContent).toContain(`SRS-${result.projectId}`);
    }, 60000);


    it('should map SRS features to SDS components', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Feature Component Mapping',
        skipClarification: true,
        generateIssues: false,
      });

      expect(result.success).toBe(true);

      // When: Analyzing counts
      const counts = countRequirements(env, result.projectId);

      // Then: SDS should have components derived from SRS features
      expect(counts.sdsComponents).toBeGreaterThan(0);
    }, 60000);


    it('should include traceability matrix in SDS', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'SDS Matrix Test',
        skipClarification: true,
        generateIssues: false,
      });

      expect(result.success).toBe(true);

      // When: Checking SDS document
      const sdsVerification = verifyDocument(env, result.projectId, 'sds');

      // Then: SDS should have traceability information
      expect(sdsVerification.exists).toBe(true);
      expect(sdsVerification.hasTraceability).toBe(true);
    }, 60000);
  });

  describe('SDS → Issues Traceability', () => {

    it('should link issues to SDS components', async () => {
      // Given: A complete pipeline with issue generation
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Issue Traceability Test',
        skipClarification: true,
        generateIssues: true,
      });

      expect(result.success).toBe(true);
      expect(result.issues).toBeDefined();

      // When: Checking issue sources
      const issues = result.issues?.issues ?? [];

      // Then: Issues should reference SDS components
      const issuesWithSource = issues.filter(
        (i) => i.sourceComponent && i.sourceComponent.length > 0
      );
      expect(issuesWithSource.length).toBeGreaterThan(0);
    }, 90000);


    it('should maintain dependency graph based on SDS', async () => {
      // Given: A complete pipeline with dependencies
      const result = await runPipeline(env, COMPLEX_FEATURE_INPUT, {
        projectName: 'Dependency Graph Test',
        skipClarification: true,
        generateIssues: true,
      });

      expect(result.success).toBe(true);
      expect(result.issues).toBeDefined();

      // When: Checking dependency graph
      const graph = result.issues?.dependencyGraph;

      // Then: Graph should have nodes and edges
      expect(graph).toBeDefined();
      expect(graph?.nodes.length).toBeGreaterThan(0);
    }, 120000);
  });

  describe('Full Chain Traceability', () => {

    it('should maintain complete traceability chain', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Full Chain Test',
        skipClarification: true,
        generateIssues: true,
      });

      expect(result.success).toBe(true);

      // When: Verifying traceability
      const traceability = verifyTraceability(env, result.projectId);

      // Then: All links should be present
      expect(traceability.prdToSrs).toBe(true);
      expect(traceability.srsToSds).toBe(true);
      expect(traceability.brokenLinks).toHaveLength(0);
    }, 90000);


    it('should preserve requirement counts through the chain', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Count Preservation Test',
        skipClarification: true,
        generateIssues: true,
      });

      expect(result.success).toBe(true);

      // When: Counting requirements at each stage
      const counts = countRequirements(env, result.projectId);

      // Then: No requirements should be lost (can only increase due to decomposition)
      expect(counts.prdFunctional).toBeGreaterThan(0);
      expect(counts.srsFeatures).toBeGreaterThanOrEqual(counts.prdFunctional);
      expect(counts.sdsComponents).toBeGreaterThan(0);
      expect(counts.issues).toBeGreaterThan(0);
    }, 90000);


    it('should have consistent document IDs across chain', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Document ID Test',
        skipClarification: true,
        generateIssues: true,
      });

      expect(result.success).toBe(true);

      // When: Reading all documents
      const prdPath = path.join(env.scratchpadPath, 'documents', result.projectId, 'prd.md');
      const srsPath = path.join(env.scratchpadPath, 'documents', result.projectId, 'srs.md');
      const sdsPath = path.join(env.scratchpadPath, 'documents', result.projectId, 'sds.md');

      const prdContent = fs.readFileSync(prdPath, 'utf-8');
      const srsContent = fs.readFileSync(srsPath, 'utf-8');
      const sdsContent = fs.readFileSync(sdsPath, 'utf-8');

      // Then: Document IDs should follow consistent pattern
      expect(prdContent).toContain(`PRD-${result.projectId}`);
      expect(srsContent).toContain(`SRS-${result.projectId}`);
      expect(sdsContent).toContain(`SDS-${result.projectId}`);
    }, 90000);
  });

  describe('Traceability Metadata', () => {

    it('should include version information in all documents', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Version Test',
        skipClarification: true,
        generateIssues: false,
      });

      expect(result.success).toBe(true);

      // When: Checking documents for metadata
      const prdVerification = verifyDocument(env, result.projectId, 'prd');
      const srsVerification = verifyDocument(env, result.projectId, 'srs');
      const sdsVerification = verifyDocument(env, result.projectId, 'sds');

      // Then: All documents should have metadata
      expect(prdVerification.hasMetadata).toBe(true);
      expect(srsVerification.hasMetadata).toBe(true);
      expect(sdsVerification.hasMetadata).toBe(true);
    }, 60000);


    it('should include timestamps in document metadata', async () => {
      // Given: A complete pipeline execution
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Timestamp Test',
        skipClarification: true,
        generateIssues: false,
      });

      expect(result.success).toBe(true);

      // When: Checking for timestamps
      const collectedInfoPath = path.join(
        env.scratchpadPath,
        'info',
        result.projectId,
        'collected_info.yaml'
      );
      const collectedContent = fs.readFileSync(collectedInfoPath, 'utf-8');

      // Then: Should contain timestamp fields
      expect(collectedContent).toMatch(/createdAt:/);
      expect(collectedContent).toMatch(/updatedAt:/);
    }, 60000);
  });
});
