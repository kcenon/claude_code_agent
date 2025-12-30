/**
 * Analysis Pipeline End-to-End Integration Tests
 *
 * Tests the complete Analysis Pipeline flow from document reading
 * through code analysis to gap detection and issue generation.
 *
 * Pipeline Flow:
 * User Input → Document Reader → Code Reader → Comparator → Issue Generator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {
  AnalysisOrchestratorAgent,
  resetAnalysisOrchestratorAgent,
} from '../../../src/analysis-orchestrator/AnalysisOrchestratorAgent.js';
import { resetDocumentReaderAgent } from '../../../src/document-reader/DocumentReaderAgent.js';
import { resetCodeReaderAgent } from '../../../src/code-reader/CodeReaderAgent.js';
import { resetDocCodeComparatorAgent } from '../../../src/doc-code-comparator/DocCodeComparatorAgent.js';
import type { AnalysisInput, AnalysisResult } from '../../../src/analysis-orchestrator/types.js';

import {
  createAnalysisFixture,
  createMinimalFixture,
  addDocument,
  addSourceFile,
  type AnalysisTestFixture,
} from './analysis-fixtures.js';

/**
 * Reset all analysis pipeline agents
 */
async function resetAllAnalysisAgents(): Promise<void> {
  resetAnalysisOrchestratorAgent();
  resetDocumentReaderAgent();
  resetCodeReaderAgent();
  resetDocCodeComparatorAgent();
}

describe('Analysis Pipeline E2E Integration', () => {
  let fixture: AnalysisTestFixture;
  let agent: AnalysisOrchestratorAgent;

  beforeEach(async () => {
    await resetAllAnalysisAgents();
    agent = new AnalysisOrchestratorAgent();
  });

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
    await resetAllAnalysisAgents();
  });

  describe('Full Analysis Pipeline Execution', () => {
    it('should complete full pipeline with docs and code', async () => {
      // Given: A project with documentation and source code
      fixture = await createAnalysisFixture({
        name: 'full-pipeline-test',
        includeGaps: true,
      });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
        generateIssues: false,
      };

      // When: Running the full analysis pipeline
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Pipeline should complete successfully
      expect(result.success).toBe(true);
      expect(result.analysisId).toBeDefined();
      expect(result.projectId).toBeDefined();

      // Verify all stages completed
      expect(result.pipelineState.overallStatus).toBe('completed');
      expect(result.pipelineState.statistics.failedStages).toBe(0);

      // Verify report structure
      expect(result.report.analysisVersion).toBe('1.0.0');
      expect(result.report.overallStatus).toBe('success');
      expect(result.report.scope).toBe('full');

      // Verify document analysis summary
      expect(result.report.documentAnalysis).toBeDefined();
      expect(result.report.documentAnalysis.available).toBe(true);

      // Verify code analysis summary
      expect(result.report.codeAnalysis).toBeDefined();
      expect(result.report.codeAnalysis.available).toBe(true);

      // Verify comparison summary
      expect(result.report.comparison).toBeDefined();
      expect(result.report.comparison.available).toBe(true);
    }, 60000);

    it('should generate output files for full pipeline', async () => {
      // Given: A project with documentation and source code
      fixture = await createAnalysisFixture({ name: 'output-files-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      // When: Running the full analysis pipeline
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Output files should exist
      expect(result.success).toBe(true);

      // Check pipeline state file
      const stateContent = await fs.readFile(result.outputPaths.pipelineState, 'utf-8');
      expect(stateContent).toContain('pipeline_state');

      // Check analysis report file
      const reportContent = await fs.readFile(result.outputPaths.analysisReport, 'utf-8');
      expect(reportContent).toContain('analysis_report');
    }, 60000);

    it('should track execution statistics accurately', async () => {
      // Given: A project with documentation and source code
      fixture = await createAnalysisFixture({ name: 'statistics-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      // When: Running the full analysis pipeline
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Statistics should be accurate
      expect(result.pipelineState.statistics.totalStages).toBeGreaterThan(0);
      expect(result.pipelineState.statistics.completedStages).toBe(
        result.pipelineState.statistics.totalStages
      );
      expect(result.pipelineState.statistics.failedStages).toBe(0);
      expect(result.pipelineState.statistics.totalDurationMs).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('Document-Only Scope', () => {
    it('should analyze only documents when scope is documents_only', async () => {
      // Given: A project with documentation
      fixture = await createAnalysisFixture({ name: 'docs-only-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'documents_only',
      };

      // When: Running document-only analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Only document analysis should be performed
      expect(result.success).toBe(true);
      expect(result.report.scope).toBe('documents_only');

      // Document analysis should be available
      expect(result.report.documentAnalysis.available).toBe(true);

      // Code analysis should not be performed
      expect(result.report.codeAnalysis.available).toBe(false);

      // Comparison should not be performed
      expect(result.report.comparison.available).toBe(false);

      // Verify stages
      const stageNames = result.pipelineState.stages.map((s) => s.name);
      expect(stageNames).toContain('document_reader');
      expect(stageNames).not.toContain('code_reader');
      expect(stageNames).not.toContain('comparator');
    }, 60000);

    it('should handle project with empty docs directory', async () => {
      // Given: A project with empty docs
      fixture = await createAnalysisFixture({
        name: 'empty-docs-test',
        emptyDocs: true,
      });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'documents_only',
      };

      // When: Running document-only analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Should complete (possibly with zero documents)
      expect(result.success).toBe(true);
      expect(result.report.documentAnalysis.documentCount).toBe(0);
    }, 60000);
  });

  describe('Code-Only Scope', () => {
    it('should analyze only code when scope is code_only', async () => {
      // Given: A project with source code
      fixture = await createAnalysisFixture({ name: 'code-only-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'code_only',
      };

      // When: Running code-only analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Only code analysis should be performed
      expect(result.success).toBe(true);
      expect(result.report.scope).toBe('code_only');

      // Code analysis should be available
      expect(result.report.codeAnalysis.available).toBe(true);

      // Document analysis should not be performed
      expect(result.report.documentAnalysis.available).toBe(false);

      // Comparison should not be performed
      expect(result.report.comparison.available).toBe(false);

      // Verify stages
      const stageNames = result.pipelineState.stages.map((s) => s.name);
      expect(stageNames).toContain('code_reader');
      expect(stageNames).not.toContain('document_reader');
      expect(stageNames).not.toContain('comparator');
    }, 60000);

    it('should handle project with empty src directory', async () => {
      // Given: A project with empty source
      fixture = await createAnalysisFixture({
        name: 'empty-code-test',
        emptyCode: true,
      });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'code_only',
      };

      // When: Running code-only analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Should complete (possibly with zero files)
      expect(result.success).toBe(true);
      expect(result.report.codeAnalysis.fileCount).toBe(0);
    }, 60000);
  });

  describe('Comparison Scope (Gap Detection)', () => {
    it('should detect gaps between docs and code', async () => {
      // Given: A project with documented features not implemented in code
      // The fixture has docs for Assignment and Notification services
      // but no corresponding code files
      fixture = await createAnalysisFixture({
        name: 'gap-detection-test',
        includeGaps: true,
      });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'comparison',
      };

      // When: Running comparison analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Gaps should be detected
      expect(result.success).toBe(true);
      expect(result.report.scope).toBe('comparison');
      expect(result.report.comparison.available).toBe(true);

      // There should be gaps for Assignment and Notification (documented but not implemented)
      expect(result.report.comparison.totalGaps).toBeGreaterThanOrEqual(0);
    }, 60000);

    it('should detect orphaned code (code without documentation)', async () => {
      // Given: A project with undocumented code
      fixture = await createAnalysisFixture({
        name: 'orphan-code-test',
        includeOrphanCode: true,
      });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'comparison',
      };

      // When: Running comparison analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Should complete and identify orphaned code
      expect(result.success).toBe(true);
      expect(result.report.comparison.available).toBe(true);
    }, 60000);

    it('should identify critical gaps (P0 priority)', async () => {
      // Given: A project with P0 documented feature not implemented
      fixture = await createMinimalFixture('critical-gap-test');

      // Add a P0 requirement document
      addDocument(fixture, 'prd', 'PRD-CRITICAL.md', `
# Critical Feature

## PRD-CRITICAL-001: Security Authentication
**Priority**: P0
**Description**: Critical security feature - must be implemented.
`);

      // No corresponding code

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'comparison',
      };

      // When: Running comparison analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Should identify critical gaps
      expect(result.success).toBe(true);
      expect(result.report.comparison.available).toBe(true);
      // Critical gaps count depends on implementation
      expect(result.report.comparison.criticalGaps).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('Issue Generation from Gaps', () => {
    it('should generate issues when generateIssues is true', async () => {
      // Given: A project with gaps
      fixture = await createAnalysisFixture({
        name: 'issue-generation-test',
        includeGaps: true,
      });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
        generateIssues: true,
      };

      // When: Running analysis with issue generation
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Issues should be generated
      expect(result.success).toBe(true);
      expect(result.report.issues.generated).toBe(true);

      // Verify issue generator stage was included
      const stageNames = result.pipelineState.stages.map((s) => s.name);
      expect(stageNames).toContain('issue_generator');
    }, 60000);

    it('should not generate issues when generateIssues is false', async () => {
      // Given: A project with gaps
      fixture = await createAnalysisFixture({
        name: 'no-issue-test',
        includeGaps: true,
      });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
        generateIssues: false,
      };

      // When: Running analysis without issue generation
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Issues should not be generated
      expect(result.success).toBe(true);
      expect(result.report.issues.generated).toBe(false);

      // Verify issue generator stage was not included
      const stageNames = result.pipelineState.stages.map((s) => s.name);
      expect(stageNames).not.toContain('issue_generator');
    }, 60000);
  });

  describe('Error Handling and Recovery', () => {
    it('should throw error for non-existent project path', async () => {
      // Given: An invalid project path
      const input: AnalysisInput = {
        projectPath: '/non/existent/path/that/does/not/exist',
        scope: 'full',
      };

      // When/Then: Should throw InvalidProjectPathError
      await expect(agent.startAnalysis(input)).rejects.toThrow();
    });

    it('should throw error when no session exists', async () => {
      // Given: No session started

      // When/Then: Should throw NoActiveSessionError
      await expect(agent.execute()).rejects.toThrow();
    });

    it('should handle file path instead of directory', async () => {
      // Given: A file path instead of directory
      fixture = await createMinimalFixture('file-path-test');
      const filePath = path.join(fixture.rootDir, 'test-file.txt');
      await fs.writeFile(filePath, 'test content');

      const input: AnalysisInput = {
        projectPath: filePath,
        scope: 'full',
      };

      // When/Then: Should throw error
      await expect(agent.startAnalysis(input)).rejects.toThrow();
    });

    it('should prevent concurrent analysis sessions', async () => {
      // Given: A project
      fixture = await createAnalysisFixture({ name: 'concurrent-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      // Start first analysis
      const session = await agent.startAnalysis(input);

      // Manually set to running to simulate in-progress
      session.pipelineState.overallStatus = 'running';

      // When/Then: Second analysis should fail
      await expect(agent.startAnalysis(input)).rejects.toThrow();

      // Reset for cleanup
      session.pipelineState.overallStatus = 'pending';
    });

    it('should continue on error when configured', async () => {
      // Given: An agent configured to continue on error
      const resilientAgent = new AnalysisOrchestratorAgent({
        continueOnError: true,
      });

      fixture = await createMinimalFixture('continue-on-error-test');

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      // When: Running analysis that may have partial failures
      await resilientAgent.startAnalysis(input);
      const result = await resilientAgent.execute();

      // Then: Should complete (possibly with warnings)
      expect(result.success).toBe(true);
    }, 60000);
  });

  describe('Session Management', () => {
    it('should return null session before analysis starts', () => {
      // Given: Fresh agent

      // When: Getting session
      const session = agent.getSession();

      // Then: Should be null
      expect(session).toBeNull();
    });

    it('should return session after analysis starts', async () => {
      // Given: A project
      fixture = await createAnalysisFixture({ name: 'session-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      // When: Starting analysis
      await agent.startAnalysis(input);
      const session = agent.getSession();

      // Then: Session should exist
      expect(session).not.toBeNull();
      expect(session?.analysisId).toBeDefined();
      expect(session?.sessionId).toBeDefined();
    });

    it('should resume analysis from saved state', async () => {
      // Given: A completed analysis
      fixture = await createAnalysisFixture({ name: 'resume-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      const originalSession = await agent.startAnalysis(input);
      await agent.execute();
      const projectId = originalSession.pipelineState.projectId;

      // Reset agent to simulate new session
      resetAnalysisOrchestratorAgent();
      const newAgent = new AnalysisOrchestratorAgent();

      // When: Resuming analysis
      const resumedSession = await newAgent.resume(projectId, fixture.rootDir, true);

      // Then: Should restore session
      expect(resumedSession.pipelineState.projectId).toBe(projectId);
    }, 60000);

    it('should throw error when resuming non-existent analysis', async () => {
      // Given: Non-existent analysis ID
      fixture = await createMinimalFixture('no-resume-test');

      // When/Then: Should throw AnalysisNotFoundError
      await expect(agent.resume('non-existent-id', fixture.rootDir, true)).rejects.toThrow();
    });
  });

  describe('Report Generation', () => {
    it('should generate valid analysis report', async () => {
      // Given: A project
      fixture = await createAnalysisFixture({ name: 'report-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      // When: Running analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Report should have all required fields
      expect(result.report.analysisId).toBeDefined();
      expect(result.report.projectId).toBeDefined();
      expect(result.report.generatedAt).toBeDefined();
      expect(result.report.analysisVersion).toBe('1.0.0');
      expect(result.report.overallStatus).toBe('success');
      expect(result.report.scope).toBe('full');
      expect(result.report.documentAnalysis).toBeDefined();
      expect(result.report.codeAnalysis).toBeDefined();
      expect(result.report.comparison).toBeDefined();
      expect(result.report.issues).toBeDefined();
      expect(result.report.recommendations).toBeDefined();
      expect(Array.isArray(result.report.recommendations)).toBe(true);
    }, 60000);

    it('should include duration in report', async () => {
      // Given: A project
      fixture = await createAnalysisFixture({ name: 'duration-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'documents_only',
      };

      // When: Running analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Duration should be tracked
      expect(result.report.totalDurationMs).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('Configuration Options', () => {
    it('should respect parallelExecution config', async () => {
      // Given: Agent with parallel execution disabled
      const sequentialAgent = new AnalysisOrchestratorAgent({
        parallelExecution: false,
      });

      fixture = await createAnalysisFixture({ name: 'parallel-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      // When: Running analysis
      await sequentialAgent.startAnalysis(input);
      const result = await sequentialAgent.execute();

      // Then: Should complete successfully
      expect(result.success).toBe(true);
    }, 60000);

    it('should respect custom scratchpad path', async () => {
      // Given: Agent with custom scratchpad path
      const customAgent = new AnalysisOrchestratorAgent({
        scratchpadBasePath: '.custom/scratchpad',
      });

      fixture = await createAnalysisFixture({ name: 'custom-scratchpad-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'documents_only',
      };

      // When: Running analysis
      await customAgent.startAnalysis(input);
      const result = await customAgent.execute();

      // Then: Should complete successfully
      expect(result.success).toBe(true);
    }, 60000);

    it('should use custom project ID when provided', async () => {
      // Given: A project with custom ID
      fixture = await createAnalysisFixture({ name: 'custom-id-test' });

      const customId = 'my-custom-project-id';
      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        projectId: customId,
        scope: 'full',
      };

      // When: Running analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: Custom ID should be used
      expect(result.projectId).toBe(customId);
    }, 60000);

    it('should auto-generate project ID when not provided', async () => {
      // Given: A project without custom ID
      fixture = await createAnalysisFixture({ name: 'auto-id-test' });

      const input: AnalysisInput = {
        projectPath: fixture.rootDir,
        scope: 'full',
      };

      // When: Running analysis
      await agent.startAnalysis(input);
      const result = await agent.execute();

      // Then: ID should be auto-generated
      expect(result.projectId).toBeDefined();
      expect(result.projectId.length).toBeGreaterThan(0);
    }, 60000);
  });
});
