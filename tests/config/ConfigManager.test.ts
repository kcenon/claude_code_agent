/**
 * Tests for ConfigManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ConfigManager,
  getConfigManager,
  resetConfigManager,
  isConfigManagerInitialized,
  resolveEnvVars,
} from '../../src/config/index.js';
import * as loader from '../../src/config/loader.js';
import type { WorkflowConfig, AgentsConfig } from '../../src/config/index.js';

// Mock the loader module
vi.mock('../../src/config/loader.js', () => ({
  loadWorkflowConfig: vi.fn(),
  loadAgentsConfig: vi.fn(),
}));

// Test fixtures
const mockWorkflowConfig: WorkflowConfig = {
  version: '1.0.0',
  name: 'test-project',
  global: {
    project_root: '${PWD}/test',
    scratchpad_dir: '.ad-sdlc/scratchpad',
    output_docs_dir: 'docs',
    log_level: 'DEBUG',
    approval_gates: {
      after_collection: true,
      after_prd: false,
      after_srs: true,
      after_sds: true,
      after_issues: false,
      before_merge: true,
    },
    retry_policy: {
      max_attempts: 5,
      backoff: 'linear',
      base_delay_seconds: 10,
      max_delay_seconds: 120,
    },
    timeouts: {
      document_generation: 600,
      issue_creation: 120,
      implementation: 3600,
      pr_review: 600,
    },
  },
  pipeline: {
    stages: [
      {
        name: 'collection',
        agent: 'collector',
        description: 'Collect requirements',
        inputs: ['user_input'],
        outputs: ['collected_info.yaml'],
        next: 'prd_generation',
        approval_required: true,
        parallel: false,
      },
      {
        name: 'prd_generation',
        agent: 'prd-writer',
        description: 'Generate PRD',
        inputs: ['collected_info.yaml'],
        outputs: ['PRD.md'],
        next: null,
        approval_required: true,
        parallel: true,
        max_parallel: 3,
      },
    ],
  },
  agents: {
    collector: {
      model: 'opus',
      tools: ['Read', 'Write', 'Bash'],
      template: 'collector-template.md',
      max_questions: 10,
      github: {
        labels_prefix: 'collector',
        auto_assign: true,
        merge_strategy: 'squash',
        delete_branch_after_merge: true,
      },
      scheduling: {
        algorithm: 'priority_dependency',
        max_workers: 5,
        check_interval_seconds: 30,
      },
      coding: {
        language: 'typescript',
        test_framework: 'vitest',
        lint_command: 'npm run lint',
        test_command: 'npm test',
        build_command: 'npm run build',
      },
      verification: {
        run_tests: true,
        run_lint: true,
        run_build: false,
        coverage_threshold: 90,
      },
      review: {
        auto_merge: true,
        require_all_checks: true,
        coverage_threshold: 85,
        max_complexity: 15,
      },
    },
    'prd-writer': {
      model: 'sonnet',
    },
  },
  quality_gates: {
    document_quality: {
      prd: {
        required_sections: ['Executive Summary', 'Requirements'],
        min_requirements: 5,
      },
      srs: {
        min_features: 3,
        min_use_cases_per_feature: 2,
      },
      sds: {
        min_components: 2,
      },
    },
    code_quality: {
      coverage_threshold: 85,
      max_complexity: 12,
      max_line_length: 120,
      no_todos_in_code: true,
      no_console_logs: false,
    },
    security: {
      no_hardcoded_secrets: true,
      require_input_validation: true,
      require_authentication: false,
    },
  },
  github: {
    repo: 'test-owner/test-repo',
    default_branch: 'develop',
    issue_labels: ['auto-generated'],
    pr_labels: ['review-needed'],
    milestone_prefix: 'Sprint',
  },
  logging: {
    level: 'DEBUG',
    format: 'text',
    output: [
      {
        type: 'file',
        path: 'logs/app.log',
        rotate: true,
        max_size: '10MB',
        max_files: 5,
        format: 'json',
      },
      {
        type: 'console',
        format: 'pretty',
      },
    ],
    include: ['config', 'agent'],
  },
};

const mockAgentsConfig: AgentsConfig = {
  version: '1.0.0',
  agents: {
    collector: {
      id: 'collector',
      name: 'Collector Agent',
      korean_name: '수집기 에이전트',
      description: 'Collects requirements from various sources',
      definition_file: '.claude/agents/collector.md',
      category: 'document_pipeline',
      order: 1,
      capabilities: ['requirement_collection', 'url_parsing', 'file_parsing'],
      io: {
        inputs: ['user_input', 'url', 'file'],
        outputs: ['collected_info.yaml'],
      },
      parallelizable: false,
      max_instances: 1,
      metrics: {
        avg_duration_seconds: 120,
        success_rate: 0.95,
        retry_rate: 0.1,
      },
    },
    'prd-writer': {
      id: 'prd-writer',
      name: 'PRD Writer Agent',
      description: 'Generates PRD documents',
      category: 'document_pipeline',
      order: 2,
    },
  },
};

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetConfigManager();

    // Setup default mocks
    vi.mocked(loader.loadWorkflowConfig).mockResolvedValue(mockWorkflowConfig);
    vi.mocked(loader.loadAgentsConfig).mockResolvedValue(mockAgentsConfig);
  });

  afterEach(() => {
    resetConfigManager();
    vi.restoreAllMocks();
  });

  describe('resolveEnvVars', () => {
    it('should resolve environment variables', () => {
      process.env.TEST_VAR = 'test-value';
      expect(resolveEnvVars('${TEST_VAR}')).toBe('test-value');
      expect(resolveEnvVars('prefix-${TEST_VAR}-suffix')).toBe('prefix-test-value-suffix');
      delete process.env.TEST_VAR;
    });

    it('should preserve unset variables', () => {
      delete process.env.UNSET_VAR;
      expect(resolveEnvVars('${UNSET_VAR}')).toBe('${UNSET_VAR}');
    });

    it('should handle multiple variables', () => {
      process.env.VAR1 = 'value1';
      process.env.VAR2 = 'value2';
      expect(resolveEnvVars('${VAR1}-${VAR2}')).toBe('value1-value2');
      delete process.env.VAR1;
      delete process.env.VAR2;
    });

    it('should handle strings without variables', () => {
      expect(resolveEnvVars('no variables here')).toBe('no variables here');
    });
  });

  describe('ConfigManager.create', () => {
    it('should create a ConfigManager instance', async () => {
      const manager = await ConfigManager.create();
      expect(manager).toBeInstanceOf(ConfigManager);
    });

    it('should load both workflow and agents configs', async () => {
      await ConfigManager.create();
      expect(loader.loadWorkflowConfig).toHaveBeenCalled();
      expect(loader.loadAgentsConfig).toHaveBeenCalled();
    });

    it('should pass baseDir option to loaders', async () => {
      await ConfigManager.create({ baseDir: '/custom/path' });
      expect(loader.loadWorkflowConfig).toHaveBeenCalledWith({
        baseDir: '/custom/path',
        validate: true,
      });
    });

    it('should skip validation when validate is false', async () => {
      await ConfigManager.create({ validate: false });
      expect(loader.loadWorkflowConfig).toHaveBeenCalledWith({
        validate: false,
      });
    });

    it('should resolve environment variables by default', async () => {
      process.env.PWD = '/test/path';
      const manager = await ConfigManager.create();
      const global = manager.getGlobalConfig();
      expect(global.projectRoot).toBe('/test/path/test');
    });

    it('should skip env var resolution when resolveEnvVars is false', async () => {
      const manager = await ConfigManager.create({ resolveEnvVars: false });
      const global = manager.getGlobalConfig();
      expect(global.projectRoot).toBe('${PWD}/test');
    });
  });

  describe('getGlobalConfig', () => {
    it('should return global configuration with correct values', async () => {
      const manager = await ConfigManager.create({ resolveEnvVars: false });
      const global = manager.getGlobalConfig();

      expect(global.projectRoot).toBe('${PWD}/test');
      expect(global.scratchpadDir).toBe('.ad-sdlc/scratchpad');
      expect(global.outputDocsDir).toBe('docs');
      expect(global.logLevel).toBe('DEBUG');
    });

    it('should return approval gates', async () => {
      const manager = await ConfigManager.create();
      const global = manager.getGlobalConfig();

      expect(global.approvalGates.afterCollection).toBe(true);
      expect(global.approvalGates.afterPrd).toBe(false);
      expect(global.approvalGates.beforeMerge).toBe(true);
    });

    it('should return retry policy', async () => {
      const manager = await ConfigManager.create();
      const global = manager.getGlobalConfig();

      expect(global.retryPolicy.maxAttempts).toBe(5);
      expect(global.retryPolicy.backoff).toBe('linear');
      expect(global.retryPolicy.baseDelaySeconds).toBe(10);
      expect(global.retryPolicy.maxDelaySeconds).toBe(120);
    });

    it('should return timeouts', async () => {
      const manager = await ConfigManager.create();
      const global = manager.getGlobalConfig();

      expect(global.timeouts.documentGeneration).toBe(600);
      expect(global.timeouts.issueCreation).toBe(120);
      expect(global.timeouts.implementation).toBe(3600);
      expect(global.timeouts.prReview).toBe(600);
    });

    it('should return defaults for missing global config', async () => {
      vi.mocked(loader.loadWorkflowConfig).mockResolvedValue({
        version: '1.0.0',
        pipeline: { stages: [] },
      });

      const manager = await ConfigManager.create();
      const global = manager.getGlobalConfig();

      expect(global.projectRoot).toBe('${PWD}');
      expect(global.logLevel).toBe('INFO');
      expect(global.retryPolicy.maxAttempts).toBe(3);
    });
  });

  describe('getRetryPolicy', () => {
    it('should return retry policy from global config', async () => {
      const manager = await ConfigManager.create();
      const retryPolicy = manager.getRetryPolicy();

      expect(retryPolicy.maxAttempts).toBe(5);
      expect(retryPolicy.backoff).toBe('linear');
    });
  });

  describe('getPipelineStages', () => {
    it('should return ordered pipeline stages', async () => {
      const manager = await ConfigManager.create();
      const stages = manager.getPipelineStages();

      expect(stages).toHaveLength(2);
      expect(stages[0]?.name).toBe('collection');
      expect(stages[1]?.name).toBe('prd_generation');
    });

    it('should map stage properties correctly', async () => {
      const manager = await ConfigManager.create();
      const stages = manager.getPipelineStages();

      const collectionStage = stages[0];
      expect(collectionStage?.agent).toBe('collector');
      expect(collectionStage?.description).toBe('Collect requirements');
      expect(collectionStage?.inputs).toEqual(['user_input']);
      expect(collectionStage?.outputs).toEqual(['collected_info.yaml']);
      expect(collectionStage?.next).toBe('prd_generation');
      expect(collectionStage?.approvalRequired).toBe(true);
      expect(collectionStage?.parallel).toBe(false);
    });

    it('should handle parallel stages', async () => {
      const manager = await ConfigManager.create();
      const stages = manager.getPipelineStages();

      const prdStage = stages[1];
      expect(prdStage?.parallel).toBe(true);
      expect(prdStage?.maxParallel).toBe(3);
    });

    it('should handle null next field', async () => {
      const manager = await ConfigManager.create();
      const stages = manager.getPipelineStages();

      expect(stages[1]?.next).toBeNull();
    });
  });

  describe('getPipelineStage', () => {
    it('should return a specific stage by name', async () => {
      const manager = await ConfigManager.create();
      const stage = manager.getPipelineStage('collection');

      expect(stage).toBeDefined();
      expect(stage?.name).toBe('collection');
    });

    it('should return undefined for non-existent stage', async () => {
      const manager = await ConfigManager.create();
      const stage = manager.getPipelineStage('non-existent');

      expect(stage).toBeUndefined();
    });
  });

  describe('getAgentConfig', () => {
    it('should return agent workflow configuration', async () => {
      const manager = await ConfigManager.create();
      const config = manager.getAgentConfig('collector');

      expect(config).toBeDefined();
      expect(config?.model).toBe('opus');
      expect(config?.tools).toEqual(['Read', 'Write', 'Bash']);
      expect(config?.template).toBe('collector-template.md');
      expect(config?.maxQuestions).toBe(10);
    });

    it('should return undefined for non-existent agent', async () => {
      const manager = await ConfigManager.create();
      const config = manager.getAgentConfig('non-existent');

      expect(config).toBeUndefined();
    });

    it('should map github settings correctly', async () => {
      const manager = await ConfigManager.create();
      const config = manager.getAgentConfig('collector');

      expect(config?.github?.labelsPrefix).toBe('collector');
      expect(config?.github?.autoAssign).toBe(true);
      expect(config?.github?.mergeStrategy).toBe('squash');
      expect(config?.github?.deleteBranchAfterMerge).toBe(true);
    });

    it('should map scheduling settings correctly', async () => {
      const manager = await ConfigManager.create();
      const config = manager.getAgentConfig('collector');

      expect(config?.scheduling?.algorithm).toBe('priority_dependency');
      expect(config?.scheduling?.maxWorkers).toBe(5);
      expect(config?.scheduling?.checkIntervalSeconds).toBe(30);
    });

    it('should map coding settings correctly', async () => {
      const manager = await ConfigManager.create();
      const config = manager.getAgentConfig('collector');

      expect(config?.coding?.language).toBe('typescript');
      expect(config?.coding?.testFramework).toBe('vitest');
      expect(config?.coding?.lintCommand).toBe('npm run lint');
    });

    it('should map verification settings correctly', async () => {
      const manager = await ConfigManager.create();
      const config = manager.getAgentConfig('collector');

      expect(config?.verification?.runTests).toBe(true);
      expect(config?.verification?.runLint).toBe(true);
      expect(config?.verification?.runBuild).toBe(false);
      expect(config?.verification?.coverageThreshold).toBe(90);
    });

    it('should map review settings correctly', async () => {
      const manager = await ConfigManager.create();
      const config = manager.getAgentConfig('collector');

      expect(config?.review?.autoMerge).toBe(true);
      expect(config?.review?.requireAllChecks).toBe(true);
      expect(config?.review?.coverageThreshold).toBe(85);
      expect(config?.review?.maxComplexity).toBe(15);
    });

    it('should return defaults for minimal agent config', async () => {
      const manager = await ConfigManager.create();
      const config = manager.getAgentConfig('prd-writer');

      expect(config?.model).toBe('sonnet');
      expect(config?.github).toBeUndefined();
      expect(config?.scheduling).toBeUndefined();
    });
  });

  describe('getConfiguredAgentIds', () => {
    it('should return all configured agent IDs', async () => {
      const manager = await ConfigManager.create();
      const ids = manager.getConfiguredAgentIds();

      expect(ids).toContain('collector');
      expect(ids).toContain('prd-writer');
      expect(ids).toHaveLength(2);
    });
  });

  describe('getAgentDefinition', () => {
    it('should return agent definition from agents.yaml', async () => {
      const manager = await ConfigManager.create();
      const definition = manager.getAgentDefinition('collector');

      expect(definition).toBeDefined();
      expect(definition?.id).toBe('collector');
      expect(definition?.name).toBe('Collector Agent');
      expect(definition?.korean_name).toBe('수집기 에이전트');
      expect(definition?.capabilities).toContain('requirement_collection');
    });

    it('should return undefined for non-existent agent', async () => {
      const manager = await ConfigManager.create();
      const definition = manager.getAgentDefinition('non-existent');

      expect(definition).toBeUndefined();
    });
  });

  describe('getAllAgentDefinitions', () => {
    it('should return all agent definitions', async () => {
      const manager = await ConfigManager.create();
      const definitions = manager.getAllAgentDefinitions();

      expect(definitions.collector).toBeDefined();
      expect(definitions['prd-writer']).toBeDefined();
    });
  });

  describe('getQualityGates', () => {
    it('should return quality gates configuration', async () => {
      const manager = await ConfigManager.create();
      const gates = manager.getQualityGates();

      expect(gates.documentQuality).toBeDefined();
      expect(gates.codeQuality).toBeDefined();
      expect(gates.security).toBeDefined();
    });

    it('should map document quality correctly', async () => {
      const manager = await ConfigManager.create();
      const gates = manager.getQualityGates();

      expect(gates.documentQuality?.prd?.requiredSections).toEqual([
        'Executive Summary',
        'Requirements',
      ]);
      expect(gates.documentQuality?.prd?.minRequirements).toBe(5);
      expect(gates.documentQuality?.srs?.minFeatures).toBe(3);
      expect(gates.documentQuality?.sds?.minComponents).toBe(2);
    });

    it('should map code quality correctly', async () => {
      const manager = await ConfigManager.create();
      const gates = manager.getQualityGates();

      expect(gates.codeQuality?.coverageThreshold).toBe(85);
      expect(gates.codeQuality?.maxComplexity).toBe(12);
      expect(gates.codeQuality?.maxLineLength).toBe(120);
      expect(gates.codeQuality?.noTodosInCode).toBe(true);
      expect(gates.codeQuality?.noConsoleLogs).toBe(false);
    });

    it('should map security correctly', async () => {
      const manager = await ConfigManager.create();
      const gates = manager.getQualityGates();

      expect(gates.security?.noHardcodedSecrets).toBe(true);
      expect(gates.security?.requireInputValidation).toBe(true);
      expect(gates.security?.requireAuthentication).toBe(false);
    });
  });

  describe('getGitHubConfig', () => {
    it('should return GitHub configuration', async () => {
      const manager = await ConfigManager.create();
      const github = manager.getGitHubConfig();

      expect(github.repo).toBe('test-owner/test-repo');
      expect(github.defaultBranch).toBe('develop');
      expect(github.issueLabels).toEqual(['auto-generated']);
      expect(github.prLabels).toEqual(['review-needed']);
      expect(github.milestonePrefix).toBe('Sprint');
    });

    it('should return defaults for missing github config', async () => {
      vi.mocked(loader.loadWorkflowConfig).mockResolvedValue({
        version: '1.0.0',
        pipeline: { stages: [] },
      });

      const manager = await ConfigManager.create();
      const github = manager.getGitHubConfig();

      expect(github.repo).toBeUndefined();
      expect(github.defaultBranch).toBe('main');
    });
  });

  describe('getLoggingConfig', () => {
    it('should return logging configuration', async () => {
      const manager = await ConfigManager.create();
      const logging = manager.getLoggingConfig();

      expect(logging.level).toBe('DEBUG');
      expect(logging.format).toBe('text');
      expect(logging.include).toEqual(['config', 'agent']);
    });

    it('should map logging outputs correctly', async () => {
      const manager = await ConfigManager.create();
      const logging = manager.getLoggingConfig();

      expect(logging.outputs).toHaveLength(2);

      const fileOutput = logging.outputs?.[0];
      expect(fileOutput?.type).toBe('file');
      expect(fileOutput?.path).toBe('logs/app.log');
      expect(fileOutput?.rotate).toBe(true);
      expect(fileOutput?.maxSize).toBe('10MB');
      expect(fileOutput?.maxFiles).toBe(5);
      expect(fileOutput?.format).toBe('json');

      const consoleOutput = logging.outputs?.[1];
      expect(consoleOutput?.type).toBe('console');
      expect(consoleOutput?.format).toBe('pretty');
    });

    it('should return defaults for missing logging config', async () => {
      vi.mocked(loader.loadWorkflowConfig).mockResolvedValue({
        version: '1.0.0',
        pipeline: { stages: [] },
      });

      const manager = await ConfigManager.create();
      const logging = manager.getLoggingConfig();

      expect(logging.level).toBe('INFO');
      expect(logging.format).toBe('json');
      expect(logging.outputs).toBeUndefined();
    });
  });

  describe('getRawWorkflowConfig', () => {
    it('should return raw workflow configuration', async () => {
      const manager = await ConfigManager.create({ resolveEnvVars: false });
      const raw = manager.getRawWorkflowConfig();

      expect(raw.version).toBe('1.0.0');
      expect(raw.name).toBe('test-project');
    });
  });

  describe('getRawAgentsConfig', () => {
    it('should return raw agents configuration', async () => {
      const manager = await ConfigManager.create();
      const raw = manager.getRawAgentsConfig();

      expect(raw.version).toBe('1.0.0');
      expect(raw.agents.collector).toBeDefined();
    });
  });

  describe('Singleton Management', () => {
    describe('getConfigManager', () => {
      it('should return the same instance on subsequent calls', async () => {
        const manager1 = await getConfigManager();
        const manager2 = await getConfigManager();

        expect(manager1).toBe(manager2);
      });

      it('should use options only on first call', async () => {
        await getConfigManager({ baseDir: '/first/path' });
        await getConfigManager({ baseDir: '/second/path' });

        expect(loader.loadWorkflowConfig).toHaveBeenCalledTimes(1);
        expect(loader.loadWorkflowConfig).toHaveBeenCalledWith({
          baseDir: '/first/path',
          validate: true,
        });
      });
    });

    describe('resetConfigManager', () => {
      it('should reset the singleton instance', async () => {
        await getConfigManager();
        expect(isConfigManagerInitialized()).toBe(true);

        resetConfigManager();
        expect(isConfigManagerInitialized()).toBe(false);
      });

      it('should allow creating new instance after reset', async () => {
        const manager1 = await getConfigManager();
        resetConfigManager();
        const manager2 = await getConfigManager();

        expect(manager1).not.toBe(manager2);
        expect(loader.loadWorkflowConfig).toHaveBeenCalledTimes(2);
      });
    });

    describe('isConfigManagerInitialized', () => {
      it('should return false when not initialized', () => {
        expect(isConfigManagerInitialized()).toBe(false);
      });

      it('should return true after initialization', async () => {
        await getConfigManager();
        expect(isConfigManagerInitialized()).toBe(true);
      });
    });
  });
});
