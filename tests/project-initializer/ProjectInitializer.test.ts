/**
 * Tests for ProjectInitializer
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as yaml from 'js-yaml';

import {
  createProjectInitializer,
  ProjectInitializer,
  resetProjectInitializer,
} from '../../src/project-initializer/ProjectInitializer.js';
import {
  getPrerequisiteValidator,
  resetPrerequisiteValidator,
} from '../../src/project-initializer/PrerequisiteValidator.js';
import { ConfigurationError } from '../../src/project-initializer/errors.js';
import * as generatedConfig from '../../src/project-initializer/generatedConfig.js';
import type { InitOptions } from '../../src/project-initializer/types.js';
import { QUALITY_GATE_CONFIGS, TEMPLATE_CONFIGS } from '../../src/project-initializer/types.js';

describe('ProjectInitializer', () => {
  let testDir: string;
  const testProjectName = 'test-project';
  let testProjectPath: string;
  let defaultOptions: InitOptions;

  beforeEach(() => {
    resetProjectInitializer();
    resetPrerequisiteValidator();
    // Use OS temp directory to avoid sandbox write restrictions on .claude paths
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-test-'));
    testProjectPath = path.join(testDir, testProjectName);
    defaultOptions = {
      projectName: testProjectName,
      techStack: 'typescript',
      template: 'standard',
      targetDir: testDir,
      skipValidation: true,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up temp directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('initialize', () => {
    it('should create project directory structure', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      const result = await initializer.initialize();

      expect(result.success).toBe(true);
      expect(result.projectPath).toBe(testProjectPath);
      expect(fs.existsSync(testProjectPath)).toBe(true);
    });

    it('should create .ad-sdlc directory with correct structure', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      expect(fs.existsSync(path.join(testProjectPath, '.ad-sdlc'))).toBe(true);
      expect(fs.existsSync(path.join(testProjectPath, '.ad-sdlc', 'config'))).toBe(true);
      expect(fs.existsSync(path.join(testProjectPath, '.ad-sdlc', 'scratchpad'))).toBe(true);
      expect(fs.existsSync(path.join(testProjectPath, '.ad-sdlc', 'templates'))).toBe(true);
      expect(fs.existsSync(path.join(testProjectPath, '.ad-sdlc', 'logs'))).toBe(true);
    });

    it('should create .claude/agents directory', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      expect(fs.existsSync(path.join(testProjectPath, '.claude'))).toBe(true);
      expect(fs.existsSync(path.join(testProjectPath, '.claude', 'agents'))).toBe(true);
    });

    it('should create docs directory with subdirectories', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      expect(fs.existsSync(path.join(testProjectPath, 'docs'))).toBe(true);
      expect(fs.existsSync(path.join(testProjectPath, 'docs', 'prd'))).toBe(true);
      expect(fs.existsSync(path.join(testProjectPath, 'docs', 'srs'))).toBe(true);
      expect(fs.existsSync(path.join(testProjectPath, 'docs', 'sds'))).toBe(true);
    });

    it('should generate workflow.yaml configuration', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      const workflowPath = path.join(testProjectPath, '.ad-sdlc', 'config', 'workflow.yaml');
      expect(fs.existsSync(workflowPath)).toBe(true);

      const content = fs.readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('version:');
      expect(content).toContain('pipeline:');
      expect(content).toContain('quality_gates:');
    });

    it('should generate agents.yaml configuration', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      const agentsPath = path.join(testProjectPath, '.ad-sdlc', 'config', 'agents.yaml');
      expect(fs.existsSync(agentsPath)).toBe(true);

      const content = fs.readFileSync(agentsPath, 'utf-8');
      expect(content).toContain('agents:');
      expect(content).toContain('collector:');
      expect(content).toContain('prd-writer:');
    });

    it('should generate template files', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      const templatesDir = path.join(testProjectPath, '.ad-sdlc', 'templates');
      expect(fs.existsSync(path.join(templatesDir, 'prd-template.md'))).toBe(true);
      expect(fs.existsSync(path.join(templatesDir, 'srs-template.md'))).toBe(true);
      expect(fs.existsSync(path.join(templatesDir, 'sds-template.md'))).toBe(true);
      expect(fs.existsSync(path.join(templatesDir, 'issue-template.md'))).toBe(true);
    });

    it('should generate agent definition files', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      const agentsDir = path.join(testProjectPath, '.claude', 'agents');
      expect(fs.existsSync(path.join(agentsDir, 'collector.md'))).toBe(true);
      expect(fs.existsSync(path.join(agentsDir, 'prd-writer.md'))).toBe(true);
      expect(fs.existsSync(path.join(agentsDir, 'srs-writer.md'))).toBe(true);
      expect(fs.existsSync(path.join(agentsDir, 'sds-writer.md'))).toBe(true);
      expect(fs.existsSync(path.join(agentsDir, 'issue-generator.md'))).toBe(true);
      expect(fs.existsSync(path.join(agentsDir, 'controller.md'))).toBe(true);
      expect(fs.existsSync(path.join(agentsDir, 'worker.md'))).toBe(true);
      expect(fs.existsSync(path.join(agentsDir, 'pr-reviewer.md'))).toBe(true);
    });

    it('should create README.md', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      const readmePath = path.join(testProjectPath, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain(testProjectName);
    });

    it('should create .gitignore', async () => {
      const initializer = new ProjectInitializer(defaultOptions);
      await initializer.initialize();

      const gitignorePath = path.join(testProjectPath, '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('# AD-SDLC');
      expect(content).toContain('.ad-sdlc/scratchpad/');
      expect(content).toContain('.ad-sdlc/logs/');
    });

    it('should fail if project already exists with .ad-sdlc', async () => {
      // Create project first
      const initializer1 = new ProjectInitializer(defaultOptions);
      await initializer1.initialize();

      // Try to create again
      const initializer2 = new ProjectInitializer(defaultOptions);
      const result = await initializer2.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should preserve all customized project files when initialization is repeated', async () => {
      await new ProjectInitializer(defaultOptions).initialize();
      const customizations = {
        '.ad-sdlc/config/workflow.yaml': '# Custom workflow\nversion: 1.0.0\ncustom: keep\n',
        '.ad-sdlc/config/agents.yaml': '# Custom registry\ncustom-agent: keep\n',
        '.claude/agents/collector.md': '# Custom Collector\r\nKeep my instructions.\r\n',
        '.claude/agents/custom-agent.md': '# Custom Agent\nKeep this agent too.\n',
        '.gitignore': '# Custom ignore rules\nprivate/\n',
        'README.md': '# Custom documentation\n',
      };
      for (const [filename, content] of Object.entries(customizations)) {
        fs.writeFileSync(path.join(testProjectPath, filename), content);
      }
      const snapshot = () => {
        const files = fs.readdirSync(testProjectPath, { recursive: true, encoding: 'utf-8' });
        return files.sort().map((filename) => {
          const filePath = path.join(testProjectPath, filename);
          return [filename, fs.statSync(filePath).isFile() ? fs.readFileSync(filePath) : null];
        });
      };
      const before = snapshot();
      const workflowBuilder = vi.spyOn(generatedConfig, 'generateWorkflowConfig');
      const agentsBuilder = vi.spyOn(generatedConfig, 'generateAgentsConfig');

      const result = await new ProjectInitializer({
        ...defaultOptions,
        template: 'enterprise',
      }).initialize();

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.createdFiles).toEqual([]);
      expect(snapshot()).toEqual(before);
      expect(workflowBuilder).not.toHaveBeenCalled();
      expect(agentsBuilder).not.toHaveBeenCalled();
    });

    it('should build each configuration once and serialize the validated original objects', async () => {
      const workflow = generatedConfig.generateWorkflowConfig(
        TEMPLATE_CONFIGS.standard,
        QUALITY_GATE_CONFIGS.standard
      );
      const agents = generatedConfig.generateAgentsConfig();
      const workflowBuilder = vi
        .spyOn(generatedConfig, 'generateWorkflowConfig')
        .mockReturnValueOnce(workflow);
      const agentsBuilder = vi
        .spyOn(generatedConfig, 'generateAgentsConfig')
        .mockReturnValueOnce(agents);

      const result = await new ProjectInitializer(defaultOptions).initialize();

      expect(result.success).toBe(true);
      expect(workflowBuilder).toHaveBeenCalledTimes(1);
      expect(agentsBuilder).toHaveBeenCalledTimes(1);
      for (const [filename, original] of [
        ['workflow.yaml', workflow],
        ['agents.yaml', agents],
      ] as const) {
        const saved = fs.readFileSync(
          path.join(testProjectPath, '.ad-sdlc', 'config', filename),
          'utf-8'
        );
        expect(yaml.load(saved)).toEqual(original);
      }
    });

    it('should apply minimal template settings', async () => {
      const options: InitOptions = {
        ...defaultOptions,
        template: 'minimal',
      };
      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const workflowPath = path.join(testProjectPath, '.ad-sdlc', 'config', 'workflow.yaml');
      const content = fs.readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('max_parallel_workers: 2');
      expect(content).toContain('coverage: 50');
    });

    it('should apply enterprise template settings', async () => {
      const options: InitOptions = {
        ...defaultOptions,
        template: 'enterprise',
      };
      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const workflowPath = path.join(testProjectPath, '.ad-sdlc', 'config', 'workflow.yaml');
      const content = fs.readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('max_parallel_workers: 5');
      expect(content).toContain('coverage: 80');
    });

    it('should include description in README when provided', async () => {
      const options: InitOptions = {
        ...defaultOptions,
        description: 'Test project description',
      };
      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const readmePath = path.join(testProjectPath, 'README.md');
      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Test project description');
    });
  });

  describe.each([true, false])(
    'configuration preflight with skipValidation=%s',
    (skipValidation) => {
      beforeEach(() => {
        vi.spyOn(getPrerequisiteValidator(), 'validate').mockResolvedValue({
          valid: true,
          checks: [],
          warnings: 0,
        });
      });

      it.each(['agents', 'workflow'] as const)(
        'should reject invalid generated %s with diagnostics before any scaffold writes',
        async (config) => {
          const workflow = generatedConfig.generateWorkflowConfig(
            TEMPLATE_CONFIGS.standard,
            QUALITY_GATE_CONFIGS.standard
          );
          const expectedPaths =
            config === 'agents'
              ? ['agents.collector.id', 'agents.collector.name']
              : ['pipeline.stages[0].name'];
          if (config === 'agents') {
            vi.spyOn(generatedConfig, 'generateAgentsConfig').mockReturnValue({
              version: '1.0.0',
              agents: { collector: { id: '', name: '' } },
            });
          } else {
            vi.spyOn(generatedConfig, 'generateWorkflowConfig').mockReturnValue({
              ...workflow,
              pipeline: { stages: [{ name: '', agent: 'collector', timeout_ms: 300000 }] },
            });
          }

          const initialization = new ProjectInitializer({
            ...defaultOptions,
            skipValidation,
          }).initialize();

          await expect(initialization).rejects.toBeInstanceOf(ConfigurationError);
          await expect(initialization).rejects.toMatchObject({ configKey: `${config}.yaml` });
          await expect(initialization).rejects.toThrow(`${config}.yaml`);
          for (const fieldPath of expectedPaths) {
            await expect(initialization).rejects.toThrow(`${fieldPath}:`);
          }
          await expect(initialization).rejects.toThrow('must be at least 1 character(s) long');
          expect(fs.existsSync(testProjectPath)).toBe(false);
          expect(fs.readdirSync(testDir)).toEqual([]);
          expect(getPrerequisiteValidator().validate).toHaveBeenCalledTimes(skipValidation ? 0 : 1);
        }
      );
    }
  );

  describe('getTemplateConfig', () => {
    it('should return correct config for minimal template', () => {
      const initializer = new ProjectInitializer(defaultOptions);
      const config = initializer.getTemplateConfig('minimal');

      expect(config.parallelWorkers).toBe(2);
      expect(config.qualityGates).toBe('basic');
      expect(config.extraFeatures).toHaveLength(0);
    });

    it('should return correct config for standard template', () => {
      const initializer = new ProjectInitializer(defaultOptions);
      const config = initializer.getTemplateConfig('standard');

      expect(config.parallelWorkers).toBe(3);
      expect(config.qualityGates).toBe('standard');
      expect(config.extraFeatures).toContain('token_tracking');
    });

    it('should return correct config for enterprise template', () => {
      const initializer = new ProjectInitializer(defaultOptions);
      const config = initializer.getTemplateConfig('enterprise');

      expect(config.parallelWorkers).toBe(5);
      expect(config.qualityGates).toBe('strict');
      expect(config.extraFeatures).toContain('audit_logging');
      expect(config.extraFeatures).toContain('security_scanning');
    });
  });

  describe('createProjectInitializer', () => {
    it('should create initializer with given options', async () => {
      const initializer = createProjectInitializer(defaultOptions);
      const result = await initializer.initialize();

      expect(result.success).toBe(true);
    });
  });
});
