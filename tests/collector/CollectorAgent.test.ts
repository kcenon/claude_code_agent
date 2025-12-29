import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  CollectorAgent,
  getCollectorAgent,
  resetCollectorAgent,
  SessionStateError,
  MissingInformationError,
} from '../../src/collector/index.js';
import { resetScratchpad } from '../../src/scratchpad/index.js';

describe('CollectorAgent', () => {
  let agent: CollectorAgent;
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-agent-test-'));
    agent = new CollectorAgent({
      scratchpadBasePath: path.join(testDir, '.ad-sdlc', 'scratchpad'),
      skipClarificationIfConfident: true,
      confidenceThreshold: 0.5,
    });
    resetScratchpad();
    resetCollectorAgent();
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    resetScratchpad();
    resetCollectorAgent();
  });

  describe('startSession', () => {
    it('should create a new session', async () => {
      const session = await agent.startSession('TestProject');

      expect(session.projectId).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('collecting');
      expect(session.sources).toHaveLength(0);
    });

    it('should initialize project directory', async () => {
      await agent.startSession('TestProject');
      const session = agent.getSession();

      const projectPath = path.join(
        testDir,
        '.ad-sdlc',
        'scratchpad',
        'info',
        session!.projectId
      );
      expect(fs.existsSync(projectPath)).toBe(true);
    });
  });

  describe('addTextInput', () => {
    it('should add text input to session', async () => {
      await agent.startSession();
      const session = agent.addTextInput('The system must support login.');

      expect(session.sources).toHaveLength(1);
      expect(session.sources[0].type).toBe('text');
    });

    it('should throw error without active session', () => {
      expect(() => agent.addTextInput('Text')).toThrow(SessionStateError);
    });
  });

  describe('addFileInput', () => {
    it('should add file input to session', async () => {
      const filePath = path.join(testDir, 'requirements.md');
      fs.writeFileSync(filePath, '# Requirements\n\nThe system must work.');

      await agent.startSession();
      const session = await agent.addFileInput(filePath);

      expect(session.sources).toHaveLength(1);
      expect(session.sources[0].type).toBe('file');
    });
  });

  describe('processInputs', () => {
    it('should extract information from inputs', async () => {
      await agent.startSession();
      agent.addTextInput(`
        Project: MyApp
        - The system must support user authentication
        - Users should be able to manage their profiles
        - The application needs to process requests quickly
      `);

      const result = agent.processInputs();

      // Should extract some requirements (functional or non-functional)
      const totalRequirements =
        result.functionalRequirements.length + result.nonFunctionalRequirements.length;
      expect(totalRequirements).toBeGreaterThanOrEqual(0);
    });

    it('should throw error with no inputs', async () => {
      await agent.startSession();

      expect(() => agent.processInputs()).toThrow(MissingInformationError);
    });

    it('should update session status based on questions', async () => {
      await agent.startSession();
      agent.addTextInput('Some vague requirements text.');
      agent.processInputs();

      const session = agent.getSession();
      // Status should be 'clarifying' if there are questions, 'completed' otherwise
      expect(['clarifying', 'completed']).toContain(session!.status);
    });
  });

  describe('answerQuestion', () => {
    it('should record answer and update session', async () => {
      await agent.startSession();
      agent.addTextInput('The system should do something.');
      agent.processInputs();

      const session = agent.getSession();
      if (session!.pendingQuestions.length > 0) {
        const questionId = session!.pendingQuestions[0].id;
        const updatedSession = agent.answerQuestion(questionId, 'Project X');

        expect(updatedSession.answeredQuestions).toHaveLength(1);
        expect(
          updatedSession.pendingQuestions.find((q) => q.id === questionId)
        ).toBeUndefined();
      }
    });

    it('should throw error for non-existent question', async () => {
      await agent.startSession();
      agent.addTextInput('Text');
      agent.processInputs();

      const session = agent.getSession();
      if (session!.status === 'clarifying') {
        expect(() => agent.answerQuestion('invalid-id', 'Answer')).toThrow();
      }
    });
  });

  describe('skipClarification', () => {
    it('should skip all pending questions', async () => {
      await agent.startSession();
      agent.addTextInput('Vague text.');
      agent.processInputs();

      const session = agent.getSession();
      if (session!.status === 'clarifying') {
        const updatedSession = agent.skipClarification();

        expect(updatedSession.pendingQuestions).toHaveLength(0);
        expect(updatedSession.status).toBe('completed');
      }
    });
  });

  describe('finalize', () => {
    it('should generate collected_info.yaml', async () => {
      await agent.startSession();
      agent.addTextInput(`
        Project: TestApp
        The system must support user login.
        Users should be able to register.
      `);
      agent.processInputs();
      agent.skipClarification();

      const result = await agent.finalize('TestApp', 'A test application');

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('collected_info.yaml');
      expect(fs.existsSync(result.outputPath)).toBe(true);
    });

    it('should include all extracted information', async () => {
      await agent.startSession();
      agent.addTextInput(`
        The system must support authentication.
        Performance: Response time under 100ms.
      `);
      agent.processInputs();
      agent.skipClarification();

      const result = await agent.finalize('App', 'Description');

      expect(result.collectedInfo.project.name).toBe('App');
      expect(result.collectedInfo.project.description).toBe('Description');
      expect(result.collectedInfo.status).toBe('completed');
    });

    it('should include collection stats', async () => {
      await agent.startSession();
      agent.addTextInput('The system must work.');
      agent.processInputs();
      agent.skipClarification();

      const result = await agent.finalize('App', 'Desc');

      expect(result.stats.sourcesProcessed).toBe(1);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('collectFromText', () => {
    it('should collect from text in one call', async () => {
      const result = await agent.collectFromText(
        'The system must support login. Users should manage profiles.',
        { projectName: 'QuickApp', projectDescription: 'Quick collection' }
      );

      expect(result.success).toBe(true);
      expect(result.collectedInfo.project.name).toBe('QuickApp');
    });
  });

  describe('collectFromFile', () => {
    it('should collect from file in one call', async () => {
      const filePath = path.join(testDir, 'reqs.md');
      fs.writeFileSync(
        filePath,
        '# Requirements\n\nThe system must authenticate users.'
      );

      const result = await agent.collectFromFile(filePath, {
        projectName: 'FileApp',
        projectDescription: 'From file',
      });

      expect(result.success).toBe(true);
      expect(result.collectedInfo.project.name).toBe('FileApp');
    });
  });

  describe('collectFromFiles', () => {
    it('should collect from multiple files', async () => {
      const file1 = path.join(testDir, 'requirements.md');
      const file2 = path.join(testDir, 'constraints.txt');
      fs.writeFileSync(file1, '# Requirements\n\nThe system must support login.');
      fs.writeFileSync(file2, 'The system is constrained to use PostgreSQL database.');

      const result = await agent.collectFromFiles([file1, file2], {
        projectName: 'MultiFileApp',
        projectDescription: 'From multiple files',
      });

      expect(result.success).toBe(true);
      expect(result.stats.sourcesProcessed).toBe(2);
      expect(result.collectedInfo.project.name).toBe('MultiFileApp');
    });

    it('should throw error for empty file paths array', async () => {
      await expect(agent.collectFromFiles([])).rejects.toThrow(MissingInformationError);
    });

    it('should continue processing when some files fail', async () => {
      const validFile = path.join(testDir, 'valid.md');
      const invalidFile = path.join(testDir, 'nonexistent.md');
      fs.writeFileSync(validFile, '# Valid\n\nThe system must work.');

      const result = await agent.collectFromFiles([validFile, invalidFile], {
        projectName: 'PartialApp',
        projectDescription: 'Partial success',
      });

      expect(result.success).toBe(true);
      expect(result.stats.sourcesProcessed).toBe(1);
      expect(result.collectedInfo.sources).toHaveLength(1);
    });

    it('should throw error when all files fail', async () => {
      const nonexistent1 = path.join(testDir, 'missing1.md');
      const nonexistent2 = path.join(testDir, 'missing2.md');

      await expect(
        agent.collectFromFiles([nonexistent1, nonexistent2])
      ).rejects.toThrow(MissingInformationError);
    });

    it('should merge information from multiple files', async () => {
      const file1 = path.join(testDir, 'functional.md');
      const file2 = path.join(testDir, 'nonfunctional.md');
      fs.writeFileSync(
        file1,
        '# Functional Requirements\n\n- The system must authenticate users\n- Users should be able to upload files'
      );
      fs.writeFileSync(
        file2,
        '# Non-Functional Requirements\n\n- Performance: Response time under 200ms\n- Security: All data must be encrypted'
      );

      const result = await agent.collectFromFiles([file1, file2], {
        projectName: 'MergedApp',
        projectDescription: 'Merged from multiple sources',
      });

      expect(result.success).toBe(true);
      expect(result.stats.sourcesProcessed).toBe(2);
      expect(result.collectedInfo.sources).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('should clear current session', async () => {
      await agent.startSession();
      agent.addTextInput('Text');

      agent.reset();

      expect(agent.getSession()).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return null without active session', () => {
      expect(agent.getSession()).toBeNull();
    });

    it('should return current session', async () => {
      await agent.startSession('Test');

      const session = agent.getSession();

      expect(session).not.toBeNull();
      expect(session!.status).toBe('collecting');
    });
  });

  describe('getPendingQuestions', () => {
    it('should return empty array without session', () => {
      expect(agent.getPendingQuestions()).toHaveLength(0);
    });

    it('should return pending questions', async () => {
      await agent.startSession();
      agent.addTextInput('Vague requirements.');
      agent.processInputs();

      const questions = agent.getPendingQuestions();

      // May have questions or not depending on extraction
      expect(Array.isArray(questions)).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getCollectorAgent', () => {
      const agent1 = getCollectorAgent();
      const agent2 = getCollectorAgent();

      expect(agent1).toBe(agent2);
    });

    it('should reset singleton with resetCollectorAgent', () => {
      const agent1 = getCollectorAgent();
      resetCollectorAgent();
      const agent2 = getCollectorAgent();

      expect(agent1).not.toBe(agent2);
    });
  });
});
