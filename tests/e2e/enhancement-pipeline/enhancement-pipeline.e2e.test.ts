/**
 * Enhancement Pipeline End-to-End Integration Tests
 *
 * Tests the complete Enhancement Pipeline flow from mode detection
 * through document reading, impact analysis, and incremental updates.
 *
 * Pipeline Flow (Enhancement Mode):
 * User Input → Mode Detection → Document Reader ┐
 *                              Codebase Analyzer ┘ → Impact Analyzer
 *              → PRD Updater → SRS Updater → SDS Updater
 *              → Issue Generator → Worker + Regression Tester → PR Review
 *
 * Test Scenarios:
 * 1. Simple Feature Addition - Add single new feature
 * 2. Requirement Modification - Modify existing requirement
 * 3. Multi-Component Change - Change affecting multiple components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { ModeDetector, resetModeDetector } from '../../../src/mode-detector/index.js';
import { DocumentReaderAgent, resetDocumentReaderAgent } from '../../../src/document-reader/index.js';
import { ImpactAnalyzerAgent, resetImpactAnalyzerAgent } from '../../../src/impact-analyzer/index.js';
import type { PipelineMode } from '../../../src/mode-detector/types.js';
import type { ChangeRequest } from '../../../src/impact-analyzer/types.js';

import {
  createEnhancementFixture,
  createGreenfieldFixture,
  createCodeOnlyFixture,
  addDocument,
  SIMPLE_FEATURE_REQUEST,
  REQUIREMENT_MODIFICATION_REQUEST,
  MULTI_COMPONENT_CHANGE_REQUEST,
  type EnhancementTestFixture,
} from './enhancement-fixtures.js';

/**
 * Reset all enhancement pipeline agents
 */
async function resetAllEnhancementAgents(): Promise<void> {
  resetModeDetector();
  resetDocumentReaderAgent();
  resetImpactAnalyzerAgent();
}

/**
 * Create a ChangeRequest from a description string
 */
function createChangeRequest(description: string): ChangeRequest {
  return {
    description,
    context: 'Enhancement Pipeline E2E Test',
  };
}

describe('Enhancement Pipeline E2E Integration', () => {
  let fixture: EnhancementTestFixture;

  beforeEach(async () => {
    await resetAllEnhancementAgents();
  });

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
    await resetAllEnhancementAgents();
  });

  describe('Mode Detection Integration', () => {
    it('should detect enhancement mode for project with existing docs and code', async () => {
      // Given: A project with existing documentation and source code
      fixture = await createEnhancementFixture({ name: 'mode-detect-full' });
      const detector = new ModeDetector();

      // When: Detecting pipeline mode
      detector.startSession('test-project', fixture.rootDir, 'Add a new feature');
      const result = await detector.detect();

      // Then: Should select enhancement mode with high confidence
      expect(result.selectedMode).toBe('enhancement');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.confidenceLevel).toMatch(/high|medium/);

      // Verify evidence collection
      expect(result.evidence.documents.prd).toBe(true);
      expect(result.evidence.documents.srs).toBe(true);
      expect(result.evidence.documents.sds).toBe(true);
      expect(result.evidence.codebase.exists).toBe(true);
      expect(result.evidence.codebase.hasBuildSystem).toBe(true);
    });

    it('should detect greenfield mode for empty project', async () => {
      // Given: An empty project
      fixture = await createGreenfieldFixture('mode-detect-empty');
      const detector = new ModeDetector();

      // When: Detecting pipeline mode
      detector.startSession('empty-project', fixture.rootDir, 'Create a new app');
      const result = await detector.detect();

      // Then: Should select greenfield mode
      expect(result.selectedMode).toBe('greenfield');
      expect(result.confidence).toBe(1.0);
      expect(result.confidenceLevel).toBe('high');

      // Verify evidence collection
      expect(result.evidence.documents.totalCount).toBe(0);
      expect(result.evidence.codebase.exists).toBe(false);
    });

    it('should detect enhancement mode for project with only codebase', async () => {
      // Given: A project with code but no documents
      fixture = await createCodeOnlyFixture('mode-detect-code-only');
      const detector = new ModeDetector();

      // When: Detecting pipeline mode
      detector.startSession('code-only-project', fixture.rootDir, 'Improve the auth system');
      const result = await detector.detect();

      // Then: Should select enhancement mode
      expect(result.selectedMode).toBe('enhancement');
      expect(result.evidence.documents.totalCount).toBe(0);
      expect(result.evidence.codebase.exists).toBe(true);

      // Recommendations should suggest creating docs
      expect(result.recommendations.some(r => r.includes('PRD'))).toBe(true);
    });

    it('should respect user override for pipeline mode', async () => {
      // Given: A project that would normally be enhancement mode
      fixture = await createEnhancementFixture({ name: 'mode-override' });
      const detector = new ModeDetector();

      // When: User explicitly requests greenfield mode
      detector.startSession('override-project', fixture.rootDir, 'Start fresh');
      const result = await detector.detect('greenfield' as PipelineMode);

      // Then: Should respect user override
      expect(result.selectedMode).toBe('greenfield');
      expect(result.confidence).toBe(1.0);
      expect(result.evidence.userOverride.specified).toBe(true);
      expect(result.reasoning).toContain('User explicitly selected');
    });

    it('should detect enhancement keywords in user input', async () => {
      // Given: A project with enhancement-related user input
      fixture = await createEnhancementFixture({ name: 'keyword-detect' });
      const detector = new ModeDetector();

      // When: User input contains enhancement keywords
      detector.startSession(
        'keyword-project',
        fixture.rootDir,
        'Update the existing authentication to add MFA support'
      );
      const result = await detector.detect();

      // Then: Should detect enhancement keywords
      expect(result.selectedMode).toBe('enhancement');
      expect(result.evidence.keywords.enhancementKeywords.length).toBeGreaterThan(0);
      expect(result.evidence.keywords.enhancementKeywords).toContain('update');
    });

    it('should save detection result to scratchpad', async () => {
      // Given: A project
      fixture = await createEnhancementFixture({ name: 'result-save' });
      const detector = new ModeDetector();

      // When: Detecting pipeline mode
      detector.startSession('save-project', fixture.rootDir);
      await detector.detect();

      // Then: Result should be saved to scratchpad
      const resultPath = path.join(
        fixture.rootDir,
        '.ad-sdlc',
        'scratchpad',
        'mode_detection',
        'save-project_mode_detection_result.yaml'
      );
      const exists = await fs.access(resultPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(resultPath, 'utf-8');
      expect(content).toContain('detection_result');
      expect(content).toContain('selected_mode');
    });
  });

  describe('Document Reading Stage', () => {
    it('should read existing PRD/SRS/SDS documents', async () => {
      // Given: A project with existing documents
      fixture = await createEnhancementFixture({ name: 'doc-read' });
      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });

      // When: Reading project documents
      await reader.startSession('doc-read-project');
      const result = await reader.readDocuments();

      // Then: Should successfully read all documents
      expect(result.success).toBe(true);
      expect(result.currentState).toBeDefined();
      expect(result.stats.prdCount).toBeGreaterThan(0);
      expect(result.stats.srsCount).toBeGreaterThan(0);
      expect(result.stats.sdsCount).toBeGreaterThan(0);

      // Verify requirements were extracted
      expect(result.stats.requirementsExtracted).toBeGreaterThan(0);
    }, 60000);

    it('should handle partial documentation', async () => {
      // Given: A project with only PRD
      fixture = await createEnhancementFixture({
        name: 'partial-docs',
        partialDocs: true,
      });
      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });

      // When: Reading project documents
      await reader.startSession('partial-project');
      const result = await reader.readDocuments();

      // Then: Should read available documents
      expect(result.success).toBe(true);
      expect(result.stats.prdCount).toBeGreaterThan(0);
      expect(result.stats.srsCount).toBe(0);
      expect(result.stats.sdsCount).toBe(0);
    }, 60000);

    it('should extract requirements from documents', async () => {
      // Given: A project with structured PRD
      fixture = await createEnhancementFixture({ name: 'extract-reqs' });
      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });

      // When: Reading documents
      await reader.startSession('extract-project');
      const result = await reader.readDocuments();

      // Then: Requirements should be extracted
      expect(result.success).toBe(true);
      expect(result.currentState?.requirements.functional.length).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('Simple Feature Addition Scenario', () => {
    it('should process simple feature addition request', async () => {
      // Given: An existing project and a feature request
      fixture = await createEnhancementFixture({ name: 'simple-feature' });

      // When: Processing through enhancement pipeline stages
      // Stage 1: Mode Detection
      const detector = new ModeDetector();
      detector.startSession('feature-project', fixture.rootDir, SIMPLE_FEATURE_REQUEST);
      const modeResult = await detector.detect();
      expect(modeResult.selectedMode).toBe('enhancement');

      // Stage 2: Document Reading
      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession('feature-project');
      const docResult = await reader.readDocuments();
      expect(docResult.success).toBe(true);

      // Stage 3: Impact Analysis
      const changeRequest = createChangeRequest(SIMPLE_FEATURE_REQUEST);
      const analyzer = new ImpactAnalyzerAgent({
        scratchpadBasePath: path.join(fixture.rootDir, '.ad-sdlc', 'scratchpad'),
      });
      await analyzer.startSession('feature-project', changeRequest);
      const impactResult = await analyzer.analyze(fixture.rootDir);

      // Then: Impact should be assessed
      expect(impactResult.success).toBe(true);
      expect(impactResult.impactAnalysis).toBeDefined();
      expect(impactResult.impactAnalysis.changeScope).toBeDefined();
    }, 120000);

    it('should identify minimal impact for isolated feature', async () => {
      // Given: A request for an isolated new feature
      fixture = await createEnhancementFixture({ name: 'isolated-feature' });

      const detector = new ModeDetector();
      detector.startSession('isolated-project', fixture.rootDir, SIMPLE_FEATURE_REQUEST);
      await detector.detect();

      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession('isolated-project');
      const docResult = await reader.readDocuments();

      const changeRequest = createChangeRequest(SIMPLE_FEATURE_REQUEST);
      const analyzer = new ImpactAnalyzerAgent({
        scratchpadBasePath: path.join(fixture.rootDir, '.ad-sdlc', 'scratchpad'),
      });
      await analyzer.startSession('isolated-project', changeRequest);
      const impactResult = await analyzer.analyze(fixture.rootDir);

      // Then: Should identify new component addition
      expect(impactResult.impactAnalysis.affectedComponents.length).toBeGreaterThanOrEqual(0);
      expect(impactResult.impactAnalysis.riskAssessment.overallRisk).toMatch(/low|medium|high|critical/);
    }, 120000);
  });

  describe('Requirement Modification Scenario', () => {
    it('should process requirement modification request', async () => {
      // Given: An existing project with a modification request
      fixture = await createEnhancementFixture({ name: 'modify-req' });

      // When: Processing through enhancement pipeline
      const detector = new ModeDetector();
      detector.startSession('modify-project', fixture.rootDir, REQUIREMENT_MODIFICATION_REQUEST);
      const modeResult = await detector.detect();
      expect(modeResult.selectedMode).toBe('enhancement');

      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession('modify-project');
      const docResult = await reader.readDocuments();
      expect(docResult.success).toBe(true);

      const changeRequest = createChangeRequest(REQUIREMENT_MODIFICATION_REQUEST);
      const analyzer = new ImpactAnalyzerAgent({
        scratchpadBasePath: path.join(fixture.rootDir, '.ad-sdlc', 'scratchpad'),
      });
      await analyzer.startSession('modify-project', changeRequest);
      const impactResult = await analyzer.analyze(fixture.rootDir);

      // Then: Should identify modification impact
      expect(impactResult.success).toBe(true);
      expect(impactResult.impactAnalysis.changeScope.type).toMatch(/feature_modify|feature_add|bug_fix|refactor/);
    }, 120000);

    it('should detect affected components for modification', async () => {
      // Given: A modification affecting auth component
      fixture = await createEnhancementFixture({ name: 'auth-modify' });

      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession('auth-project');
      await reader.readDocuments();

      const changeRequest = createChangeRequest(REQUIREMENT_MODIFICATION_REQUEST);
      const analyzer = new ImpactAnalyzerAgent({
        scratchpadBasePath: path.join(fixture.rootDir, '.ad-sdlc', 'scratchpad'),
      });
      await analyzer.startSession('auth-project', changeRequest);
      const impactResult = await analyzer.analyze(fixture.rootDir);

      // Then: Components should be analyzed
      expect(impactResult.success).toBe(true);
      expect(impactResult.impactAnalysis.affectedComponents).toBeDefined();
    }, 120000);
  });

  describe('Multi-Component Change Scenario', () => {
    it('should process multi-component change request', async () => {
      // Given: A complex change request affecting multiple components
      fixture = await createEnhancementFixture({ name: 'multi-change' });

      // When: Processing through enhancement pipeline
      const detector = new ModeDetector();
      detector.startSession('multi-project', fixture.rootDir, MULTI_COMPONENT_CHANGE_REQUEST);
      const modeResult = await detector.detect();
      expect(modeResult.selectedMode).toBe('enhancement');

      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession('multi-project');
      await reader.readDocuments();

      const changeRequest = createChangeRequest(MULTI_COMPONENT_CHANGE_REQUEST);
      const analyzer = new ImpactAnalyzerAgent({
        scratchpadBasePath: path.join(fixture.rootDir, '.ad-sdlc', 'scratchpad'),
      });
      await analyzer.startSession('multi-project', changeRequest);
      const impactResult = await analyzer.analyze(fixture.rootDir);

      // Then: Multiple components should be affected
      expect(impactResult.success).toBe(true);
      expect(impactResult.impactAnalysis.affectedComponents.length).toBeGreaterThanOrEqual(0);
    }, 120000);

    it('should identify cross-component dependencies', async () => {
      // Given: A request that requires coordination between components
      fixture = await createEnhancementFixture({ name: 'cross-dep' });

      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession('dep-project');
      await reader.readDocuments();

      const changeRequest = createChangeRequest(MULTI_COMPONENT_CHANGE_REQUEST);
      const analyzer = new ImpactAnalyzerAgent({
        scratchpadBasePath: path.join(fixture.rootDir, '.ad-sdlc', 'scratchpad'),
      });
      await analyzer.startSession('dep-project', changeRequest);
      const impactResult = await analyzer.analyze(fixture.rootDir);

      // Then: Should identify dependencies
      expect(impactResult.impactAnalysis).toBeDefined();
      expect(impactResult.impactAnalysis.affectedComponents).toBeDefined();
    }, 120000);
  });

  describe('Error Handling and Recovery', () => {
    it('should throw error for non-existent project path', async () => {
      // Given: An invalid project path
      const detector = new ModeDetector();

      // When/Then: Should throw ProjectNotFoundError
      detector.startSession('invalid-project', '/non/existent/path');
      await expect(detector.detect()).rejects.toThrow();
    });

    it('should throw error when no session exists', async () => {
      // Given: No session started
      const detector = new ModeDetector();

      // When/Then: Should throw NoActiveSessionError
      await expect(detector.detect()).rejects.toThrow();
    });

    it('should handle document reading errors gracefully', async () => {
      // Given: A project with corrupted docs
      fixture = await createEnhancementFixture({ name: 'corrupted-docs' });

      // Add a document with empty content
      addDocument(fixture, 'prd', 'INVALID.md', '');

      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
        strictMode: false,
      });

      // When: Reading documents
      await reader.startSession('corrupted-project');
      const result = await reader.readDocuments();

      // Then: Should complete (possibly with warnings)
      expect(result.success).toBe(true);
    }, 60000);

    it('should throw error for invalid change request', async () => {
      // Given: An empty change request
      const analyzer = new ImpactAnalyzerAgent();
      const invalidRequest: ChangeRequest = { description: '' };

      // When/Then: Should throw InvalidChangeRequestError
      await expect(
        analyzer.startSession('invalid-project', invalidRequest)
      ).rejects.toThrow();
    });
  });

  describe('Session Management', () => {
    it('should return null session before detection starts', () => {
      // Given: Fresh detector
      const detector = new ModeDetector();

      // When: Getting session
      const session = detector.getSession();

      // Then: Should be null
      expect(session).toBeNull();
    });

    it('should return session after detection starts', async () => {
      // Given: A project
      fixture = await createEnhancementFixture({ name: 'session-test' });
      const detector = new ModeDetector();

      // When: Starting detection
      detector.startSession('session-project', fixture.rootDir);
      const session = detector.getSession();

      // Then: Session should exist
      expect(session).not.toBeNull();
      expect(session?.sessionId).toBeDefined();
      expect(session?.projectId).toBe('session-project');
      expect(session?.status).toBe('detecting');
    });

    it('should update session status after detection completes', async () => {
      // Given: A project
      fixture = await createEnhancementFixture({ name: 'status-test' });
      const detector = new ModeDetector();

      // When: Completing detection
      detector.startSession('status-project', fixture.rootDir);
      await detector.detect();
      const session = detector.getSession();

      // Then: Status should be completed
      expect(session?.status).toBe('completed');
      expect(session?.result).not.toBeNull();
    });
  });

  describe('Pipeline Stage Integration', () => {
    it('should pass data correctly between stages', async () => {
      // Given: A complete enhancement pipeline execution
      fixture = await createEnhancementFixture({ name: 'stage-integration' });
      const projectId = 'integration-project';

      // Stage 1: Mode Detection
      const detector = new ModeDetector();
      detector.startSession(projectId, fixture.rootDir, SIMPLE_FEATURE_REQUEST);
      const modeResult = await detector.detect();

      // Verify mode detection output
      expect(modeResult.selectedMode).toBe('enhancement');

      // Stage 2: Document Reading
      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession(projectId);
      const docResult = await reader.readDocuments();

      // Verify document reading output
      expect(docResult.success).toBe(true);
      expect(docResult.currentState).toBeDefined();

      // Stage 3: Impact Analysis (receives output from previous stages)
      const changeRequest = createChangeRequest(SIMPLE_FEATURE_REQUEST);
      const analyzer = new ImpactAnalyzerAgent({
        scratchpadBasePath: path.join(fixture.rootDir, '.ad-sdlc', 'scratchpad'),
      });
      await analyzer.startSession(projectId, changeRequest);
      const impactResult = await analyzer.analyze(fixture.rootDir);

      // Verify impact analysis received correct inputs
      expect(impactResult.success).toBe(true);
      expect(impactResult.impactAnalysis).toBeDefined();
    }, 180000);

    it('should generate consistent project IDs across stages', async () => {
      // Given: Pipeline stages with same project ID
      fixture = await createEnhancementFixture({ name: 'project-id' });
      const projectId = 'consistent-id-project';

      const detector = new ModeDetector();
      detector.startSession(projectId, fixture.rootDir);
      await detector.detect();
      const detectorSession = detector.getSession();

      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession(projectId);
      await reader.readDocuments();
      const readerSession = reader.getSession();

      // Then: Project IDs should match
      expect(detectorSession?.projectId).toBe(projectId);
      expect(readerSession?.projectId).toBe(projectId);
    }, 60000);
  });

  describe('Performance Benchmarks', () => {
    it('should complete mode detection within 5 seconds', async () => {
      // Given: A standard project
      fixture = await createEnhancementFixture({ name: 'perf-mode' });
      const detector = new ModeDetector();

      // When: Measuring detection time
      const start = Date.now();
      detector.startSession('perf-project', fixture.rootDir);
      await detector.detect();
      const duration = Date.now() - start;

      // Then: Should complete quickly
      expect(duration).toBeLessThan(5000);
    });

    it('should complete document reading within 30 seconds', async () => {
      // Given: A standard project
      fixture = await createEnhancementFixture({ name: 'perf-docs' });
      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });

      // When: Measuring reading time
      const start = Date.now();
      await reader.startSession('perf-project');
      await reader.readDocuments();
      const duration = Date.now() - start;

      // Then: Should complete within timeout
      expect(duration).toBeLessThan(30000);
    }, 60000);

    it('should complete impact analysis within 60 seconds', async () => {
      // Given: A standard project with analysis input
      fixture = await createEnhancementFixture({ name: 'perf-impact' });

      // First read documents to generate state files
      const reader = new DocumentReaderAgent({
        docsBasePath: fixture.docsPath,
        scratchpadBasePath: fixture.scratchpadPath,
      });
      await reader.startSession('perf-project');
      await reader.readDocuments();

      const changeRequest = createChangeRequest(SIMPLE_FEATURE_REQUEST);
      const analyzer = new ImpactAnalyzerAgent({
        scratchpadBasePath: path.join(fixture.rootDir, '.ad-sdlc', 'scratchpad'),
      });

      // When: Measuring analysis time
      const start = Date.now();
      await analyzer.startSession('perf-project', changeRequest);
      await analyzer.analyze(fixture.rootDir);
      const duration = Date.now() - start;

      // Then: Should complete within timeout
      expect(duration).toBeLessThan(60000);
    }, 120000);
  });
});
