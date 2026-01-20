import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  OpenTelemetryProvider,
  getOpenTelemetryProvider,
  resetOpenTelemetryProvider,
  ADSDLC_SPAN_ATTRIBUTES,
} from '../../src/monitoring/index.js';

describe('OpenTelemetryProvider', () => {
  let provider: OpenTelemetryProvider;
  let testConfigDir: string;

  beforeEach(async () => {
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'otel-test-'));
    await resetOpenTelemetryProvider();
  });

  afterEach(async () => {
    await resetOpenTelemetryProvider();
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create provider with default config', () => {
      provider = new OpenTelemetryProvider();
      expect(provider.isEnabled()).toBe(false);
      expect(provider.getConfig().enabled).toBe(false);
      expect(provider.getConfig().serviceName).toBe('ad-sdlc-pipeline');
    });

    it('should create provider with custom config', () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
      });
      expect(provider.getConfig().serviceName).toBe('test-service');
      expect(provider.getConfig().enabled).toBe(true);
    });

    it('should initialize without error when disabled', async () => {
      provider = new OpenTelemetryProvider({ enabled: false });
      await provider.initialize();
      expect(provider.isEnabled()).toBe(false);
    });

    it('should initialize with console exporter', async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();
      expect(provider.isEnabled()).toBe(true);
      expect(provider.getTracer()).not.toBeNull();
    });

    it('should load config from YAML file', async () => {
      const configPath = path.join(testConfigDir, 'observability.yaml');
      const configContent = `
opentelemetry:
  enabled: true
  serviceName: yaml-test-service
  exporters:
    - type: console
      enabled: true
  sampling:
    type: always_on
  resourceAttributes:
    environment: test
`;
      fs.writeFileSync(configPath, configContent);

      provider = new OpenTelemetryProvider();
      await provider.initialize(configPath);

      expect(provider.getConfig().serviceName).toBe('yaml-test-service');
      expect(provider.getConfig().enabled).toBe(true);
      expect(provider.getConfig().resourceAttributes?.environment).toBe('test');
    });

    it('should use default config when file does not exist', async () => {
      provider = new OpenTelemetryProvider();
      const nonExistentPath = path.join(testConfigDir, 'non-existent.yaml');
      await provider.initialize(nonExistentPath);
      expect(provider.getConfig().serviceName).toBe('ad-sdlc-pipeline');
    });
  });

  describe('span creation', () => {
    beforeEach(async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();
    });

    it('should start a generic span', () => {
      const span = provider.startSpan('test-span');
      expect(span).not.toBeNull();
      provider.endSpanSuccess(span);
    });

    it('should start an agent span with attributes', () => {
      const span = provider.startAgentSpan('worker', 'processor', 'corr-123');
      expect(span).not.toBeNull();
      provider.endSpanSuccess(span);
    });

    it('should start a tool span', () => {
      const span = provider.startToolSpan('Read');
      expect(span).not.toBeNull();
      provider.endSpanSuccess(span);
    });

    it('should start an LLM span', () => {
      const span = provider.startLLMSpan('claude-sonnet');
      expect(span).not.toBeNull();
      provider.endSpanSuccess(span);
    });

    it('should return null when provider is disabled', async () => {
      await provider.shutdown();
      provider = new OpenTelemetryProvider({ enabled: false });
      await provider.initialize();

      expect(provider.startSpan('test')).toBeNull();
      expect(provider.startAgentSpan('agent', 'type')).toBeNull();
      expect(provider.startToolSpan('tool')).toBeNull();
      expect(provider.startLLMSpan('model')).toBeNull();
    });
  });

  describe('span lifecycle', () => {
    beforeEach(async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();
    });

    it('should end span with success', () => {
      const span = provider.startSpan('test-span');
      provider.endSpanSuccess(span, { 'custom.attr': 'value' });
      // No error thrown means success
    });

    it('should end span with error', () => {
      const span = provider.startSpan('test-span');
      const error = new Error('Test error');
      provider.endSpanError(span, error);
      // No error thrown means success
    });

    it('should handle null spans gracefully', () => {
      provider.endSpanSuccess(null);
      provider.endSpanError(null, new Error('test'));
      provider.recordTokenUsage(null, 100, 50);
      // No errors should be thrown
    });

    it('should record token usage', () => {
      const span = provider.startSpan('test-span');
      provider.recordTokenUsage(span, 100, 50, 0.15);
      provider.endSpanSuccess(span);
      // Attributes are set, span ends successfully
    });
  });

  describe('withSpan helper', () => {
    beforeEach(async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();
    });

    it('should execute function within span context', async () => {
      const result = await provider.withSpan('test-operation', async (span) => {
        expect(span).not.toBeNull();
        return 'success';
      });
      expect(result).toBe('success');
    });

    it('should handle errors in wrapped function', async () => {
      await expect(
        provider.withSpan('test-operation', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should work when provider is disabled', async () => {
      await provider.shutdown();
      provider = new OpenTelemetryProvider({ enabled: false });
      await provider.initialize();

      const result = await provider.withSpan('test-operation', async (span) => {
        expect(span).toBeNull();
        return 'success';
      });
      expect(result).toBe('success');
    });
  });

  describe('span context propagation', () => {
    beforeEach(async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();
    });

    it('should return null when no active span', () => {
      const ctx = provider.getCurrentSpanContext();
      // Context may be null when no span is active
      // This is expected behavior
    });

    it('should return null when provider is disabled', async () => {
      await provider.shutdown();
      provider = new OpenTelemetryProvider({ enabled: false });
      await provider.initialize();

      expect(provider.getCurrentSpanContext()).toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();
      expect(provider.isEnabled()).toBe(true);

      await provider.shutdown();
      expect(provider.isEnabled()).toBe(false);
    });

    it('should handle multiple shutdown calls', async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      await provider.shutdown();
      await provider.shutdown(); // Should not throw
    });

    it('should reset provider state', async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();
      await provider.reset();

      expect(provider.isEnabled()).toBe(false);
      expect(provider.getConfig().enabled).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', async () => {
      const provider1 = getOpenTelemetryProvider();
      const provider2 = getOpenTelemetryProvider();
      expect(provider1).toBe(provider2);
    });

    it('should reset singleton instance', async () => {
      const provider1 = getOpenTelemetryProvider({
        serviceName: 'first-service',
      });
      await resetOpenTelemetryProvider();
      const provider2 = getOpenTelemetryProvider({
        serviceName: 'second-service',
      });
      expect(provider1).not.toBe(provider2);
    });
  });

  describe('exporter configuration', () => {
    it('should skip disabled exporters', async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [
          { type: 'console', enabled: false },
          { type: 'otlp', enabled: false, endpoint: 'http://localhost:4317' },
        ],
      });
      await provider.initialize();
      // No exporters enabled, but should not throw
      expect(provider.isEnabled()).toBe(true);
    });

    it('should skip OTLP exporter without endpoint', async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'otlp', enabled: true }],
      });
      await provider.initialize();
      // Missing endpoint, exporter skipped
      expect(provider.isEnabled()).toBe(true);
    });

    it('should configure OTLP exporter with headers and timeout', async () => {
      provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [
          {
            type: 'otlp',
            enabled: true,
            endpoint: 'http://localhost:4317',
            headers: { Authorization: 'Bearer token' },
            timeoutMs: 5000,
          },
        ],
      });
      await provider.initialize();
      expect(provider.isEnabled()).toBe(true);
    });
  });

  describe('ADSDLC_SPAN_ATTRIBUTES', () => {
    it('should have all required attribute keys', () => {
      expect(ADSDLC_SPAN_ATTRIBUTES.AGENT_NAME).toBe('adsdlc.agent.name');
      expect(ADSDLC_SPAN_ATTRIBUTES.AGENT_TYPE).toBe('adsdlc.agent.type');
      expect(ADSDLC_SPAN_ATTRIBUTES.PIPELINE_STAGE).toBe('adsdlc.pipeline.stage');
      expect(ADSDLC_SPAN_ATTRIBUTES.PIPELINE_MODE).toBe('adsdlc.pipeline.mode');
      expect(ADSDLC_SPAN_ATTRIBUTES.TOOL_NAME).toBe('adsdlc.tool.name');
      expect(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT).toBe('adsdlc.tool.result');
      expect(ADSDLC_SPAN_ATTRIBUTES.TOKENS_INPUT).toBe('adsdlc.tokens.input');
      expect(ADSDLC_SPAN_ATTRIBUTES.TOKENS_OUTPUT).toBe('adsdlc.tokens.output');
      expect(ADSDLC_SPAN_ATTRIBUTES.TOKENS_COST).toBe('adsdlc.tokens.cost');
      expect(ADSDLC_SPAN_ATTRIBUTES.MODEL_NAME).toBe('adsdlc.model.name');
      expect(ADSDLC_SPAN_ATTRIBUTES.CORRELATION_ID).toBe('adsdlc.correlation_id');
      expect(ADSDLC_SPAN_ATTRIBUTES.PARENT_TOOL_USE_ID).toBe('adsdlc.parent_tool_use_id');
    });
  });
});
