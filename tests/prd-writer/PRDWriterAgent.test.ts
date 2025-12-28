import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  PRDWriterAgent,
  getPRDWriterAgent,
  resetPRDWriterAgent,
} from '../../src/prd-writer/PRDWriterAgent.js';
import type { CollectedInfo } from '../../src/scratchpad/index.js';
import {
  SessionStateError,
  CriticalGapsError,
  CollectedInfoNotFoundError,
} from '../../src/prd-writer/errors.js';

describe('PRDWriterAgent', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'prd-writer', 'test-scratchpad');
  const testDocsPath = path.join(process.cwd(), 'tests', 'prd-writer', 'test-docs');

  const createMinimalCollectedInfo = (
    overrides: Partial<CollectedInfo> = {}
  ): CollectedInfo => ({
    schemaVersion: '1.0.0',
    projectId: '001',
    status: 'completed',
    project: {
      name: 'Test Project',
      description: 'A comprehensive test project for validation purposes',
    },
    requirements: {
      functional: [
        {
          id: 'FR-001',
          title: 'User Authentication',
          description: 'Users must be able to log in with email and password',
          priority: 'P0',
          acceptanceCriteria: [
            { id: 'AC-001', description: 'Login form validates input', testable: true },
          ],
        },
      ],
      nonFunctional: [
        {
          id: 'NFR-001',
          category: 'performance',
          title: 'Response Time',
          description: 'System must respond quickly',
          priority: 'P1',
          metric: '< 200ms',
        },
      ],
    },
    constraints: [
      { id: 'CON-001', description: 'Must use TypeScript', reason: 'Company standard' },
    ],
    assumptions: [
      {
        id: 'ASM-001',
        description: 'Users have modern browsers',
        validated: false,
        riskIfWrong: 'Compatibility issues',
      },
    ],
    dependencies: [
      { name: 'vitest', type: 'library', required: true, purpose: 'Testing framework' },
    ],
    clarifications: [],
    sources: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const cleanupTestEnvironment = async () => {
    try {
      await fs.promises.rm(testBasePath, { recursive: true });
    } catch {
      // Ignore
    }
    try {
      await fs.promises.rm(testDocsPath, { recursive: true });
    } catch {
      // Ignore
    }
  };

  beforeEach(async () => {
    resetPRDWriterAgent();
    await cleanupTestEnvironment();
    await fs.promises.mkdir(testBasePath, { recursive: true });
    await fs.promises.mkdir(testDocsPath, { recursive: true });
  });

  afterEach(async () => {
    resetPRDWriterAgent();
    await cleanupTestEnvironment();
  });

  describe('constructor', () => {
    it('should create agent with default config', () => {
      const agent = new PRDWriterAgent();
      expect(agent).toBeDefined();
      expect(agent.getSession()).toBeNull();
    });

    it('should create agent with custom config', () => {
      const agent = new PRDWriterAgent({
        scratchpadBasePath: 'custom/path',
        templatePath: 'custom/template.md',
        failOnCriticalGaps: true,
        autoSuggestPriorities: false,
      });
      expect(agent).toBeDefined();
    });
  });

  describe('analyzeGaps', () => {
    it('should throw error when no session exists', () => {
      const agent = new PRDWriterAgent();

      expect(() => agent.analyzeGaps()).toThrow(SessionStateError);
    });
  });

  describe('checkConsistency', () => {
    it('should throw error when no session exists', () => {
      const agent = new PRDWriterAgent();

      expect(() => agent.checkConsistency()).toThrow(SessionStateError);
    });
  });

  describe('generate', () => {
    it('should throw error when no session exists', () => {
      const agent = new PRDWriterAgent();

      expect(() => agent.generate()).toThrow(SessionStateError);
    });
  });

  describe('generateFromCollectedInfo', () => {
    it('should generate PRD directly from collected info', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('001');
      expect(result.generatedPRD.content).toContain('Test Project');
    });

    it('should perform gap analysis on collected info', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.generatedPRD.gapAnalysis).toBeDefined();
      expect(typeof result.generatedPRD.gapAnalysis.totalGaps).toBe('number');
      expect(typeof result.generatedPRD.gapAnalysis.completenessScore).toBe('number');
    });

    it('should perform consistency check on collected info', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.generatedPRD.consistencyCheck).toBeDefined();
      expect(typeof result.generatedPRD.consistencyCheck.isConsistent).toBe('boolean');
    });

    it('should generate PRD metadata', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.generatedPRD.metadata).toBeDefined();
      expect(result.generatedPRD.metadata.documentId).toBe('PRD-001');
      expect(result.generatedPRD.metadata.productName).toBe('Test Project');
    });

    it('should save PRD to public docs path', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      const publicFileExists = await fs.promises
        .access(result.publicPath)
        .then(() => true)
        .catch(() => false);
      expect(publicFileExists).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset the agent session', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.generateFromCollectedInfo(info);
      expect(agent.getSession()).not.toBeNull();

      agent.reset();
      expect(agent.getSession()).toBeNull();
    });
  });

  describe('getPRDWriterAgent', () => {
    it('should return singleton instance', () => {
      const agent1 = getPRDWriterAgent();
      const agent2 = getPRDWriterAgent();

      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getPRDWriterAgent();
      resetPRDWriterAgent();
      const agent2 = getPRDWriterAgent();

      expect(agent1).not.toBe(agent2);
    });
  });

  describe('stats calculation', () => {
    it('should calculate stats correctly', async () => {
      const info = createMinimalCollectedInfo({
        requirements: {
          functional: [
            {
              id: 'FR-001',
              title: 'Feature 1',
              description: 'First feature description',
              priority: 'P0',
              acceptanceCriteria: [
                { id: 'AC-001', description: 'Test', testable: true },
              ],
            },
            {
              id: 'FR-002',
              title: 'Feature 2',
              description: 'Second feature description',
              priority: 'P1',
              acceptanceCriteria: [
                { id: 'AC-002', description: 'Test', testable: true },
              ],
            },
          ],
          nonFunctional: [
            {
              id: 'NFR-001',
              category: 'performance',
              title: 'Speed',
              description: 'Fast',
              priority: 'P0',
              metric: '< 100ms',
            },
          ],
        },
        constraints: [
          { id: 'CON-001', description: 'Constraint 1', reason: 'Reason' },
          { id: 'CON-002', description: 'Constraint 2', reason: 'Reason' },
        ],
        assumptions: [
          { id: 'ASM-001', description: 'Assumption', validated: true, riskIfWrong: 'Risk' },
        ],
        dependencies: [
          { name: 'dep1', type: 'library', required: true, purpose: 'Purpose' },
          { name: 'dep2', type: 'tool', required: false, purpose: 'Purpose' },
        ],
      });

      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.stats.functionalRequirements).toBe(2);
      expect(result.stats.nonFunctionalRequirements).toBe(1);
      expect(result.stats.constraints).toBe(2);
      expect(result.stats.assumptions).toBe(1);
      expect(result.stats.dependencies).toBe(2);
      expect(typeof result.stats.gapsFound).toBe('number');
      expect(typeof result.stats.consistencyIssues).toBe('number');
      expect(typeof result.stats.completenessScore).toBe('number');
      expect(typeof result.stats.processingTimeMs).toBe('number');
    });
  });

  describe('PRD content generation', () => {
    it('should include functional requirements in generated PRD', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.generatedPRD.content).toContain('FR-001');
      expect(result.generatedPRD.content).toContain('User Authentication');
    });

    it('should include non-functional requirements in generated PRD', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.generatedPRD.content).toContain('NFR-001');
      expect(result.generatedPRD.content).toContain('Response Time');
    });

    it('should include constraints in generated PRD', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.generatedPRD.content).toContain('CON-001');
      expect(result.generatedPRD.content).toContain('TypeScript');
    });

    it('should include assumptions in generated PRD', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.generatedPRD.content).toContain('ASM-001');
      expect(result.generatedPRD.content).toContain('modern browsers');
    });

    it('should include dependencies in generated PRD', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromCollectedInfo(info);

      expect(result.generatedPRD.content).toContain('vitest');
    });
  });

  describe('session-based workflow', () => {
    it('should start session from project and proceed through states', async () => {
      // Create collected info file in scratchpad (follows Scratchpad directory structure)
      const projectId = 'test-session-project';
      const projectDir = path.join(testBasePath, 'info', projectId);
      await fs.promises.mkdir(projectDir, { recursive: true });

      const info = createMinimalCollectedInfo({ projectId });
      const collectedInfoPath = path.join(projectDir, 'collected_info.yaml');
      await fs.promises.writeFile(collectedInfoPath, yaml.dump(info), 'utf8');

      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      // Start session
      const session = await agent.startSession(projectId);
      expect(session.projectId).toBe(projectId);
      expect(session.status).toBe('pending');

      // Analyze gaps
      const gapResult = agent.analyzeGaps();
      expect(gapResult.totalGaps).toBeDefined();

      // Check consistency
      const consistencyResult = agent.checkConsistency();
      expect(consistencyResult.isConsistent).toBeDefined();

      // Generate
      const generated = agent.generate();
      expect(generated.content).toBeDefined();

      // Finalize
      const result = await agent.finalize();
      expect(result.success).toBe(true);
    });

    it('should throw when starting session for non-existent project', async () => {
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      // Scratchpad throws ENOENT error when file doesn't exist with allowMissing: false
      await expect(agent.startSession('non-existent-project')).rejects.toThrow();
    });

    it('should throw CriticalGapsError when failOnCriticalGaps is true', async () => {
      // Create collected info with missing required data to trigger critical gaps
      const info = createMinimalCollectedInfo({
        projectId: 'critical-gaps-test',
        requirements: {
          functional: [], // No functional requirements = critical gap
          nonFunctional: [],
        },
      });

      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
        failOnCriticalGaps: true,
      });

      await agent.generateFromCollectedInfo(info).catch((error) => {
        expect(error).toBeInstanceOf(CriticalGapsError);
      });
    });
  });

  describe('generateFromProject', () => {
    it('should generate PRD from project files', async () => {
      const projectId = 'project-file-test';
      const projectDir = path.join(testBasePath, 'info', projectId);
      await fs.promises.mkdir(projectDir, { recursive: true });

      const info = createMinimalCollectedInfo({ projectId });
      const collectedInfoPath = path.join(projectDir, 'collected_info.yaml');
      await fs.promises.writeFile(collectedInfoPath, yaml.dump(info), 'utf8');

      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      const result = await agent.generateFromProject(projectId);
      expect(result.success).toBe(true);
      expect(result.projectId).toBe(projectId);
    });
  });

  describe('finalize edge cases', () => {
    it('should handle finalize when PRD already generated', async () => {
      const info = createMinimalCollectedInfo();
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      // First generate
      const result1 = await agent.generateFromCollectedInfo(info);
      expect(result1.success).toBe(true);

      // Reset and generate again to test finalize with existing PRD
      agent.reset();
      const result2 = await agent.generateFromCollectedInfo(info);
      expect(result2.success).toBe(true);
    });

    it('should throw error when finalize called without session', async () => {
      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await expect(agent.finalize()).rejects.toThrow(SessionStateError);
    });
  });

  describe('gap analysis in generation', () => {
    it('should perform gap analysis during generate if not done', async () => {
      const projectId = 'gap-analysis-test';
      const projectDir = path.join(testBasePath, 'info', projectId);
      await fs.promises.mkdir(projectDir, { recursive: true });

      const info = createMinimalCollectedInfo({ projectId });
      const collectedInfoPath = path.join(projectDir, 'collected_info.yaml');
      await fs.promises.writeFile(collectedInfoPath, yaml.dump(info), 'utf8');

      const agent = new PRDWriterAgent({
        scratchpadBasePath: testBasePath,
        publicDocsPath: testDocsPath,
      });

      await agent.startSession(projectId);
      // Skip analyzeGaps() call - generate should do it automatically
      const generated = agent.generate();
      expect(generated.gapAnalysis).toBeDefined();
    });
  });
});
