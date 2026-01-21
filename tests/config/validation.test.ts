/**
 * Tests for configuration validation module
 */

import { describe, it, expect } from 'vitest';
import {
  validateWorkflowConfig,
  validateAgentsConfig,
  assertWorkflowConfig,
  assertAgentsConfig,
  getConfigSchemaVersion,
  isCompatibleConfigVersion,
  ConfigValidationError,
  CONFIG_SCHEMA_VERSION,
  OpenTelemetryConfigSchema,
  ObservabilityConfigSchema,
} from '../../src/config/index.js';

describe('Config Validation', () => {
  describe('getConfigSchemaVersion', () => {
    it('should return current schema version', () => {
      const version = getConfigSchemaVersion();
      expect(version).toBe(CONFIG_SCHEMA_VERSION);
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('isCompatibleConfigVersion', () => {
    it('should return true for compatible versions', () => {
      expect(isCompatibleConfigVersion({ version: '1.0.0' })).toBe(true);
      expect(isCompatibleConfigVersion({ version: '1.1.0' })).toBe(true);
      expect(isCompatibleConfigVersion({ version: '1.2.3' })).toBe(true);
    });

    it('should return false for incompatible major versions', () => {
      expect(isCompatibleConfigVersion({ version: '2.0.0' })).toBe(false);
      expect(isCompatibleConfigVersion({ version: '0.1.0' })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isCompatibleConfigVersion(null)).toBe(false);
      expect(isCompatibleConfigVersion(undefined)).toBe(false);
      expect(isCompatibleConfigVersion('1.0.0')).toBe(false);
    });

    it('should return false for missing version', () => {
      expect(isCompatibleConfigVersion({})).toBe(false);
      expect(isCompatibleConfigVersion({ name: 'test' })).toBe(false);
    });
  });

  describe('validateWorkflowConfig', () => {
    it('should validate minimal valid workflow config', () => {
      const config = {
        version: '1.0.0',
        pipeline: {
          stages: [
            {
              name: 'test-stage',
              agent: 'test-agent',
            },
          ],
        },
      };

      const result = validateWorkflowConfig(config);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.version).toBe('1.0.0');
    });

    it('should validate full workflow config', () => {
      const config = {
        version: '1.0.0',
        name: 'Test Workflow',
        global: {
          project_root: '${PWD}',
          scratchpad_dir: '.ad-sdlc/scratchpad',
          log_level: 'INFO',
          approval_gates: {
            after_collection: true,
            after_prd: false,
          },
          retry_policy: {
            max_attempts: 3,
            backoff: 'exponential',
          },
        },
        pipeline: {
          stages: [
            {
              name: 'collection',
              agent: 'collector',
              description: 'Collect requirements',
              approval_required: true,
              next: 'prd',
            },
            {
              name: 'prd',
              agent: 'prd-writer',
              parallel: false,
            },
          ],
        },
        agents: {
          collector: {
            model: 'sonnet',
            tools: ['Read', 'Write', 'Grep'],
            max_questions: 5,
          },
        },
        quality_gates: {
          code_quality: {
            coverage_threshold: 80,
            max_complexity: 10,
          },
        },
      };

      const result = validateWorkflowConfig(config);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Test Workflow');
    });

    it('should reject invalid version format', () => {
      const config = {
        version: 'invalid',
        pipeline: { stages: [{ name: 'test', agent: 'test' }] },
      };

      const result = validateWorkflowConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should reject missing required fields', () => {
      const config = {
        version: '1.0.0',
        // missing pipeline
      };

      const result = validateWorkflowConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.path.includes('pipeline'))).toBe(true);
    });

    it('should reject empty stages array', () => {
      const config = {
        version: '1.0.0',
        pipeline: { stages: [] },
      };

      const result = validateWorkflowConfig(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid model type', () => {
      const config = {
        version: '1.0.0',
        pipeline: { stages: [{ name: 'test', agent: 'test' }] },
        agents: {
          test: { model: 'invalid-model' },
        },
      };

      const result = validateWorkflowConfig(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid tool names', () => {
      const config = {
        version: '1.0.0',
        pipeline: { stages: [{ name: 'test', agent: 'test' }] },
        agents: {
          test: { tools: ['InvalidTool'] },
        },
      };

      const result = validateWorkflowConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe('validateAgentsConfig', () => {
    it('should validate minimal valid agents config', () => {
      const config = {
        version: '1.0.0',
        agents: {
          collector: {
            id: 'collector',
            name: 'Collector Agent',
          },
        },
      };

      const result = validateAgentsConfig(config);
      expect(result.success).toBe(true);
      expect(result.data?.agents.collector.name).toBe('Collector Agent');
    });

    it('should validate full agents config', () => {
      const config = {
        version: '1.0.0',
        agents: {
          collector: {
            id: 'collector',
            name: 'Collector Agent',
            korean_name: '수집 에이전트',
            description: 'Collects requirements',
            definition_file: '.claude/agents/collector.md',
            category: 'document_pipeline',
            order: 1,
            capabilities: ['multi_source_input', 'information_extraction'],
            io: {
              inputs: ['user_message', 'files'],
              outputs: ['collected_info.yaml'],
            },
            metrics: {
              avg_duration_seconds: 120,
              success_rate: 0.95,
            },
          },
        },
        categories: {
          document_pipeline: {
            name: 'Document Pipeline',
            description: 'Document generation agents',
            agents: ['collector'],
            execution_mode: 'sequential',
          },
        },
        relationships: {
          dependencies: {
            'prd-writer': { requires: ['collector'] },
          },
          data_flow: [
            { from: 'collector', to: 'prd-writer', data: 'collected_info.yaml' },
          ],
        },
        models: {
          sonnet: {
            id: 'claude-sonnet-4-20250514',
            context_window: 200000,
            cost_per_1k_input: 0.003,
          },
        },
      };

      const result = validateAgentsConfig(config);
      expect(result.success).toBe(true);
    });

    it('should reject missing agent id', () => {
      const config = {
        version: '1.0.0',
        agents: {
          test: {
            name: 'Test Agent',
            // missing id
          },
        },
      };

      const result = validateAgentsConfig(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid category', () => {
      const config = {
        version: '1.0.0',
        agents: {
          test: {
            id: 'test',
            name: 'Test',
            category: 'invalid_category',
          },
        },
      };

      const result = validateAgentsConfig(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid success rate', () => {
      const config = {
        version: '1.0.0',
        agents: {
          test: {
            id: 'test',
            name: 'Test',
            metrics: { success_rate: 1.5 }, // > 1
          },
        },
      };

      const result = validateAgentsConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe('assertWorkflowConfig', () => {
    it('should return validated data for valid config', () => {
      const config = {
        version: '1.0.0',
        pipeline: { stages: [{ name: 'test', agent: 'test' }] },
      };

      const result = assertWorkflowConfig(config, 'test.yaml');
      expect(result.version).toBe('1.0.0');
    });

    it('should throw ConfigValidationError for invalid config', () => {
      const config = { version: 'invalid' };

      expect(() => assertWorkflowConfig(config, 'test.yaml')).toThrow(ConfigValidationError);
    });

    it('should include file path in error', () => {
      const config = { version: 'invalid' };

      try {
        assertWorkflowConfig(config, 'workflow.yaml');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).filePath).toBe('workflow.yaml');
      }
    });

    it('should format errors correctly', () => {
      const config = { version: 'invalid' };

      try {
        assertWorkflowConfig(config, 'test.yaml');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        const formatted = (error as ConfigValidationError).formatErrors();
        expect(formatted).toContain('version');
      }
    });
  });

  describe('assertAgentsConfig', () => {
    it('should return validated data for valid config', () => {
      const config = {
        version: '1.0.0',
        agents: { test: { id: 'test', name: 'Test' } },
      };

      const result = assertAgentsConfig(config, 'agents.yaml');
      expect(result.agents.test.name).toBe('Test');
    });

    it('should throw ConfigValidationError for invalid config', () => {
      const config = { version: '1.0.0', agents: {} };

      // Empty agents should be valid
      const result = assertAgentsConfig(config, 'agents.yaml');
      expect(result.agents).toEqual({});
    });
  });

  describe('OpenTelemetryConfigSchema', () => {
    it('should validate minimal valid config with defaults', () => {
      const config = {};
      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
        expect(result.data.serviceName).toBe('ad-sdlc-pipeline');
        expect(result.data.exporters).toHaveLength(1);
        expect(result.data.exporters[0].type).toBe('console');
      }
    });

    it('should validate full config with all options', () => {
      const config = {
        enabled: true,
        serviceName: 'my-service',
        exporters: [
          { type: 'console', enabled: true },
          { type: 'otlp', endpoint: 'http://localhost:4317', enabled: true },
        ],
        sampling: {
          type: 'probability',
          probability: 0.5,
        },
        resourceAttributes: {
          environment: 'production',
          serviceVersion: '1.0.0',
          custom: { team: 'platform' },
        },
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.serviceName).toBe('my-service');
        expect(result.data.exporters).toHaveLength(2);
        expect(result.data.sampling?.probability).toBe(0.5);
      }
    });

    it('should reject missing probability for probability sampling', () => {
      const config = {
        enabled: true,
        serviceName: 'test',
        exporters: [{ type: 'console' }],
        sampling: {
          type: 'probability',
          // missing probability
        },
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject missing rateLimit for rate_limiting sampling', () => {
      const config = {
        enabled: true,
        serviceName: 'test',
        exporters: [{ type: 'console' }],
        sampling: {
          type: 'rate_limiting',
          // missing rateLimit
        },
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject missing endpoint for enabled OTLP exporter', () => {
      const config = {
        enabled: true,
        serviceName: 'test',
        exporters: [{ type: 'otlp', enabled: true }],
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept disabled OTLP exporter without endpoint', () => {
      const config = {
        enabled: true,
        serviceName: 'test',
        exporters: [{ type: 'otlp', enabled: false }],
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid endpoint URL', () => {
      const config = {
        enabled: true,
        serviceName: 'test',
        exporters: [{ type: 'otlp', endpoint: 'not-a-url' }],
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should validate Jaeger exporter with endpoint', () => {
      const config = {
        enabled: true,
        serviceName: 'test',
        exporters: [{ type: 'jaeger', endpoint: 'http://localhost:14268/api/traces' }],
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid sampling type', () => {
      const config = {
        enabled: true,
        serviceName: 'test',
        exporters: [{ type: 'console' }],
        sampling: {
          type: 'invalid_type',
        },
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject probability out of range', () => {
      const config = {
        enabled: true,
        serviceName: 'test',
        exporters: [{ type: 'console' }],
        sampling: {
          type: 'probability',
          probability: 1.5, // > 1
        },
      };

      const result = OpenTelemetryConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('ObservabilityConfigSchema', () => {
    it('should validate config with opentelemetry section', () => {
      const config = {
        opentelemetry: {
          enabled: true,
          serviceName: 'test-service',
          exporters: [{ type: 'console' }],
        },
      };

      const result = ObservabilityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate empty config', () => {
      const config = {};
      const result = ObservabilityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});
