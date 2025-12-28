/**
 * Analysis Orchestrator Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  AnalysisOrchestratorAgent,
  getAnalysisOrchestratorAgent,
  resetAnalysisOrchestratorAgent,
} from '../../src/analysis-orchestrator/AnalysisOrchestratorAgent.js';
import {
  AnalysisInProgressError,
  AnalysisNotFoundError,
  InvalidProjectPathError,
  NoActiveSessionError,
} from '../../src/analysis-orchestrator/errors.js';
import type {
  AnalysisInput,
  AnalysisOrchestratorConfig,
} from '../../src/analysis-orchestrator/types.js';

describe('AnalysisOrchestratorAgent', () => {
  let tempDir: string;
  let agent: AnalysisOrchestratorAgent;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analysis-orchestrator-test-'));
    agent = new AnalysisOrchestratorAgent();
    resetAnalysisOrchestratorAgent();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetAnalysisOrchestratorAgent();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const agent = new AnalysisOrchestratorAgent();
      expect(agent).toBeInstanceOf(AnalysisOrchestratorAgent);
    });

    it('should create with custom config', () => {
      const config: AnalysisOrchestratorConfig = {
        scratchpadBasePath: '.custom/scratchpad',
        parallelExecution: false,
        continueOnError: false,
        maxRetries: 5,
      };
      const agent = new AnalysisOrchestratorAgent(config);
      expect(agent).toBeInstanceOf(AnalysisOrchestratorAgent);
    });

    it('should merge custom config with defaults', () => {
      const config: AnalysisOrchestratorConfig = {
        maxRetries: 5,
      };
      const agent = new AnalysisOrchestratorAgent(config);
      expect(agent).toBeInstanceOf(AnalysisOrchestratorAgent);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getAnalysisOrchestratorAgent', () => {
      resetAnalysisOrchestratorAgent();
      const agent1 = getAnalysisOrchestratorAgent();
      const agent2 = getAnalysisOrchestratorAgent();
      expect(agent1).toBe(agent2);
    });

    it('should return new instance after reset', () => {
      resetAnalysisOrchestratorAgent();
      const agent1 = getAnalysisOrchestratorAgent();
      resetAnalysisOrchestratorAgent();
      const agent2 = getAnalysisOrchestratorAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('startAnalysis', () => {
    it('should start a new analysis session with valid input', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'full',
        generateIssues: false,
      };
      const session = await agent.startAnalysis(input);

      expect(session.sessionId).toBeDefined();
      expect(session.analysisId).toBeDefined();
      expect(session.pipelineState.projectPath).toBe(path.resolve(tempDir));
      expect(session.pipelineState.scope).toBe('full');
      expect(session.pipelineState.generateIssues).toBe(false);
      expect(session.pipelineState.overallStatus).toBe('pending');
    });

    it('should create session with custom project ID', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        projectId: 'custom-project-id',
      };
      const session = await agent.startAnalysis(input);

      expect(session.pipelineState.projectId).toBe('custom-project-id');
    });

    it('should auto-generate project ID when not provided', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
      };
      const session = await agent.startAnalysis(input);

      expect(session.pipelineState.projectId).toBeDefined();
      expect(session.pipelineState.projectId.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent project path', async () => {
      const input: AnalysisInput = {
        projectPath: '/non/existent/path',
      };

      await expect(agent.startAnalysis(input)).rejects.toThrow(InvalidProjectPathError);
    });

    it('should throw error when analysis already in progress', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
      };
      const session = await agent.startAnalysis(input);

      // Manually set status to running to simulate in-progress analysis
      // This tests the guard condition without relying on timing/race conditions
      session.pipelineState.overallStatus = 'running';

      // Try to start another analysis - should fail
      await expect(agent.startAnalysis(input)).rejects.toThrow(AnalysisInProgressError);

      // Reset status to allow cleanup
      session.pipelineState.overallStatus = 'pending';
    });

    it('should create correct stages for full scope', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'full',
        generateIssues: false,
      };
      const session = await agent.startAnalysis(input);

      const stageNames = session.pipelineState.stages.map((s) => s.name);
      expect(stageNames).toContain('document_reader');
      expect(stageNames).toContain('code_reader');
      expect(stageNames).toContain('comparator');
      expect(stageNames).not.toContain('issue_generator');
    });

    it('should include issue_generator when generateIssues is true', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'full',
        generateIssues: true,
      };
      const session = await agent.startAnalysis(input);

      const stageNames = session.pipelineState.stages.map((s) => s.name);
      expect(stageNames).toContain('issue_generator');
    });

    it('should create correct stages for documents_only scope', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'documents_only',
      };
      const session = await agent.startAnalysis(input);

      const stageNames = session.pipelineState.stages.map((s) => s.name);
      expect(stageNames).toContain('document_reader');
      expect(stageNames).not.toContain('code_reader');
      expect(stageNames).not.toContain('comparator');
    });

    it('should create correct stages for code_only scope', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'code_only',
      };
      const session = await agent.startAnalysis(input);

      const stageNames = session.pipelineState.stages.map((s) => s.name);
      expect(stageNames).toContain('code_reader');
      expect(stageNames).not.toContain('document_reader');
      expect(stageNames).not.toContain('comparator');
    });
  });

  describe('getSession', () => {
    it('should return null when no session exists', () => {
      expect(agent.getSession()).toBeNull();
    });

    it('should return current session after startAnalysis', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
      };
      await agent.startAnalysis(input);

      const session = agent.getSession();
      expect(session).not.toBeNull();
      expect(session?.analysisId).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should throw error when no session exists', async () => {
      await expect(agent.execute()).rejects.toThrow(NoActiveSessionError);
    });

    it('should execute pipeline and return result', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'full',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();

      expect(result.success).toBe(true);
      expect(result.analysisId).toBeDefined();
      expect(result.projectId).toBeDefined();
      expect(result.report).toBeDefined();
      expect(result.outputPaths.pipelineState).toBeDefined();
      expect(result.outputPaths.analysisReport).toBeDefined();
    });

    it('should update pipeline state during execution', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'documents_only',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();
      const session = agent.getSession();

      expect(session?.pipelineState.overallStatus).toBe('completed');
      expect(result.pipelineState.stages.every((s) => s.status === 'completed')).toBe(true);
    });

    it('should generate output files', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'full',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();

      // Check that state file exists
      const stateContent = await fs.readFile(result.outputPaths.pipelineState, 'utf-8');
      expect(stateContent).toContain('pipeline_state');

      // Check that report file exists
      const reportContent = await fs.readFile(result.outputPaths.analysisReport, 'utf-8');
      expect(reportContent).toContain('analysis_report');
    });

    it('should generate recommendations in report', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'documents_only',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();

      expect(result.report.recommendations).toBeDefined();
      expect(Array.isArray(result.report.recommendations)).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should throw error for non-existent analysis', async () => {
      await expect(agent.getStatus('non-existent-id', tempDir)).rejects.toThrow(
        AnalysisNotFoundError
      );
    });

    it('should return status for existing analysis', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
      };
      const session = await agent.startAnalysis(input);
      await agent.execute();

      // Create a new agent instance to test status retrieval
      const newAgent = new AnalysisOrchestratorAgent();
      const status = await newAgent.getStatus(session.pipelineState.projectId, tempDir);

      expect(status.analysisId).toBe(session.analysisId);
      expect(status.overallStatus).toBe('completed');
    });
  });

  describe('resume', () => {
    it('should resume analysis from saved state', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
      };
      const originalSession = await agent.startAnalysis(input);
      await agent.execute();

      // Reset agent to simulate new session
      resetAnalysisOrchestratorAgent();
      const newAgent = new AnalysisOrchestratorAgent();

      const resumedSession = await newAgent.resume(
        originalSession.pipelineState.projectId,
        tempDir,
        true
      );

      // Resume uses projectId, so check that the projectId matches
      expect(resumedSession.pipelineState.projectId).toBe(originalSession.pipelineState.projectId);
    });

    it('should throw error for non-existent analysis', async () => {
      await expect(agent.resume('non-existent-id', tempDir, true)).rejects.toThrow(
        AnalysisNotFoundError
      );
    });
  });

  describe('pipeline stages', () => {
    it('should track statistics correctly', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'full',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();

      expect(result.pipelineState.statistics.totalStages).toBeGreaterThan(0);
      expect(result.pipelineState.statistics.completedStages).toBe(
        result.pipelineState.statistics.totalStages
      );
      expect(result.pipelineState.statistics.failedStages).toBe(0);
      // Duration might be 0 for very fast execution, so check it's defined
      expect(result.pipelineState.statistics.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle comparison scope correctly', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'comparison',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();
      const stageNames = result.pipelineState.stages.map((s) => s.name);

      expect(stageNames).toContain('document_reader');
      expect(stageNames).toContain('code_reader');
      expect(stageNames).toContain('comparator');
    });
  });

  describe('report generation', () => {
    it('should generate valid analysis report', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'full',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();
      const report = result.report;

      expect(report.analysisId).toBeDefined();
      expect(report.projectId).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.analysisVersion).toBe('1.0.0');
      expect(report.overallStatus).toBe('success');
      expect(report.scope).toBe('full');
      expect(report.documentAnalysis).toBeDefined();
      expect(report.codeAnalysis).toBeDefined();
      expect(report.comparison).toBeDefined();
      expect(report.issues).toBeDefined();
    });

    it('should include duration in report', async () => {
      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'documents_only',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();

      // Duration might be 0 for very fast execution, so check it's defined
      expect(result.report.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should throw InvalidProjectPathError for file path instead of directory', async () => {
      // Create a file instead of directory
      const filePath = path.join(tempDir, 'file.txt');
      await fs.writeFile(filePath, 'test');

      const input: AnalysisInput = {
        projectPath: filePath,
      };

      await expect(agent.startAnalysis(input)).rejects.toThrow(InvalidProjectPathError);
    });
  });

  describe('configuration options', () => {
    it('should respect parallelExecution config', async () => {
      const agent = new AnalysisOrchestratorAgent({
        parallelExecution: false,
      });

      const input: AnalysisInput = {
        projectPath: tempDir,
        scope: 'full',
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();
      expect(result.success).toBe(true);
    });

    it('should respect continueOnError config', async () => {
      const agent = new AnalysisOrchestratorAgent({
        continueOnError: true,
      });

      const input: AnalysisInput = {
        projectPath: tempDir,
      };
      await agent.startAnalysis(input);

      const result = await agent.execute();
      expect(result.success).toBe(true);
    });
  });
});
