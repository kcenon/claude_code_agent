import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OpenTelemetryProvider,
  resetOpenTelemetryProvider,
  startAgentSpan,
  startToolSpan,
  startLLMSpan,
  recordToolResult,
  withAgentSpan,
  withToolSpan,
  withLLMSpan,
  withTracedAgent,
  propagateToSubagent,
  getCurrentContext,
  runInContext,
  runInContextAsync,
  SpanWrapper,
  ADSDLC_SPAN_ATTRIBUTES,
} from '../../src/monitoring/index.js';

describe('Tracing Utilities', () => {
  beforeEach(async () => {
    await resetOpenTelemetryProvider();
  });

  afterEach(async () => {
    await resetOpenTelemetryProvider();
  });

  describe('SpanWrapper', () => {
    it('should wrap null span gracefully', () => {
      const wrapper = new SpanWrapper(null);
      expect(wrapper.getSpan()).toBeNull();
      expect(wrapper.isEnded()).toBe(false);

      // All operations should be no-ops
      wrapper.setAttribute('key', 'value');
      wrapper.setAttributes({ key: 'value' });
      wrapper.addEvent('event');
      wrapper.recordTokenUsage(100, 50, 0.1);
      wrapper.endSuccess();

      expect(wrapper.isEnded()).toBe(true);
    });

    it('should prevent double ending', () => {
      const wrapper = new SpanWrapper(null);
      wrapper.endSuccess();
      expect(wrapper.isEnded()).toBe(true);

      // Second end should be no-op
      wrapper.endError(new Error('test'));
      expect(wrapper.isEnded()).toBe(true);
    });

    it('should return context even with null span', () => {
      const wrapper = new SpanWrapper(null);
      const ctx = wrapper.getContext();
      expect(ctx).toBeDefined();
    });

    it('should support chained setAttribute calls', () => {
      const wrapper = new SpanWrapper(null);
      const result = wrapper
        .setAttribute('key1', 'value1')
        .setAttribute('key2', 'value2')
        .setAttributes({ key3: 'value3' });
      expect(result).toBe(wrapper);
    });
  });

  describe('startAgentSpan', () => {
    it('should return SpanWrapper when tracing disabled', () => {
      const span = startAgentSpan({
        agentName: 'test-agent',
        agentType: 'processor',
      });

      expect(span).toBeInstanceOf(SpanWrapper);
      expect(span.getSpan()).toBeNull();
      span.endSuccess();
    });

    it('should create span with basic attributes', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const span = startAgentSpan({
        agentName: 'worker',
        agentType: 'processor',
      });

      expect(span).toBeInstanceOf(SpanWrapper);
      span.endSuccess();
    });

    it('should include optional attributes when provided', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const span = startAgentSpan({
        agentName: 'worker',
        agentType: 'processor',
        correlationId: 'corr-123',
        parentToolUseId: 'tool-use-456',
        pipelineStage: 'implementation',
        pipelineMode: 'greenfield',
      });

      expect(span).toBeInstanceOf(SpanWrapper);
      span.endSuccess();
    });
  });

  describe('startToolSpan', () => {
    it('should return SpanWrapper when tracing disabled', () => {
      const span = startToolSpan({
        toolName: 'Read',
      });

      expect(span).toBeInstanceOf(SpanWrapper);
      expect(span.getSpan()).toBeNull();
      span.endSuccess();
    });

    it('should create span with tool name', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const span = startToolSpan({
        toolName: 'Read',
      });

      expect(span).toBeInstanceOf(SpanWrapper);
      span.endSuccess();
    });

    it('should accept parent context', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const parentSpan = startAgentSpan({
        agentName: 'parent',
        agentType: 'orchestrator',
      });

      const childSpan = startToolSpan({
        toolName: 'Write',
        parentContext: parentSpan.getContext(),
      });

      childSpan.endSuccess();
      parentSpan.endSuccess();
    });
  });

  describe('recordToolResult', () => {
    it('should record success result', () => {
      const span = startToolSpan({ toolName: 'Read' });

      recordToolResult(span, {
        success: true,
        result: 'file content loaded',
      });

      expect(span.isEnded()).toBe(true);
    });

    it('should record success without explicit result', () => {
      const span = startToolSpan({ toolName: 'Read' });

      recordToolResult(span, {
        success: true,
      });

      expect(span.isEnded()).toBe(true);
    });

    it('should record error result with Error object', () => {
      const span = startToolSpan({ toolName: 'Read' });
      const error = new Error('File not found');

      recordToolResult(span, {
        success: false,
        error,
      });

      expect(span.isEnded()).toBe(true);
    });

    it('should record error result without Error object', () => {
      const span = startToolSpan({ toolName: 'Read' });

      recordToolResult(span, {
        success: false,
        result: 'Permission denied',
      });

      expect(span.isEnded()).toBe(true);
    });

    it('should record error result with no details', () => {
      const span = startToolSpan({ toolName: 'Read' });

      recordToolResult(span, {
        success: false,
      });

      expect(span.isEnded()).toBe(true);
    });
  });

  describe('withAgentSpan', () => {
    it('should execute function and return result', async () => {
      const result = await withAgentSpan(
        {
          agentName: 'test-agent',
          agentType: 'processor',
        },
        async (span) => {
          expect(span).toBeInstanceOf(SpanWrapper);
          return 'success';
        }
      );

      expect(result).toBe('success');
    });

    it('should handle errors and rethrow', async () => {
      await expect(
        withAgentSpan(
          {
            agentName: 'test-agent',
            agentType: 'processor',
          },
          async () => {
            throw new Error('Test error');
          }
        )
      ).rejects.toThrow('Test error');
    });

    it('should not end span twice if already ended in function', async () => {
      const result = await withAgentSpan(
        {
          agentName: 'test-agent',
          agentType: 'processor',
        },
        async (span) => {
          span.endSuccess({ 'custom.attr': 42 });
          return 'ended early';
        }
      );

      expect(result).toBe('ended early');
    });

    it('should handle non-Error throws', async () => {
      await expect(
        withAgentSpan(
          {
            agentName: 'test-agent',
            agentType: 'processor',
          },
          async () => {
            throw 'string error';
          }
        )
      ).rejects.toBe('string error');
    });
  });

  describe('withToolSpan', () => {
    it('should execute function and return result', async () => {
      const result = await withToolSpan(
        {
          toolName: 'Read',
        },
        async (span) => {
          expect(span).toBeInstanceOf(SpanWrapper);
          return 'file content';
        }
      );

      expect(result).toBe('file content');
    });

    it('should handle errors and rethrow', async () => {
      await expect(
        withToolSpan(
          {
            toolName: 'Read',
          },
          async () => {
            throw new Error('File not found');
          }
        )
      ).rejects.toThrow('File not found');
    });

    it('should not end span twice if already ended in function', async () => {
      const result = await withToolSpan(
        {
          toolName: 'Read',
        },
        async (span) => {
          span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT, 'custom result');
          span.endSuccess();
          return 'ended early';
        }
      );

      expect(result).toBe('ended early');
    });

    it('should handle non-Error throws', async () => {
      await expect(
        withToolSpan(
          {
            toolName: 'Read',
          },
          async () => {
            throw 'string error';
          }
        )
      ).rejects.toBe('string error');
    });
  });

  describe('propagateToSubagent', () => {
    it('should add event and return context', () => {
      const parentSpan = startAgentSpan({
        agentName: 'orchestrator',
        agentType: 'coordinator',
      });

      const context = propagateToSubagent(parentSpan, 'tool-use-123');

      expect(context).toBeDefined();
      parentSpan.endSuccess();
    });

    it('should work with enabled tracing', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const parentSpan = startAgentSpan({
        agentName: 'orchestrator',
        agentType: 'coordinator',
      });

      const subagentContext = propagateToSubagent(parentSpan, 'tool-use-456');

      const childSpan = startAgentSpan({
        agentName: 'worker',
        agentType: 'processor',
        parentToolUseId: 'tool-use-456',
        parentContext: subagentContext,
      });

      childSpan.endSuccess();
      parentSpan.endSuccess();
    });
  });

  describe('getCurrentContext', () => {
    it('should return current context', () => {
      const ctx = getCurrentContext();
      expect(ctx).toBeDefined();
    });
  });

  describe('runInContext', () => {
    it('should execute function in context', () => {
      const ctx = getCurrentContext();
      const result = runInContext(ctx, () => 'executed');
      expect(result).toBe('executed');
    });
  });

  describe('runInContextAsync', () => {
    it('should execute async function in context', async () => {
      const ctx = getCurrentContext();
      const result = await runInContextAsync(ctx, async () => {
        return 'executed async';
      });
      expect(result).toBe('executed async');
    });
  });

  describe('startLLMSpan', () => {
    it('should return SpanWrapper when tracing disabled', () => {
      const span = startLLMSpan({
        modelName: 'claude-3-sonnet',
      });

      expect(span).toBeInstanceOf(SpanWrapper);
      expect(span.getSpan()).toBeNull();
      span.endSuccess();
    });

    it('should create span with model name', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const span = startLLMSpan({
        modelName: 'claude-3-opus',
      });

      expect(span).toBeInstanceOf(SpanWrapper);
      span.endSuccess();
    });

    it('should accept parent context', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const agentSpan = startAgentSpan({
        agentName: 'worker',
        agentType: 'processor',
      });

      const llmSpan = startLLMSpan({
        modelName: 'claude-3-sonnet',
        parentContext: agentSpan.getContext(),
      });

      llmSpan.recordTokenUsage(1500, 800, 0.08);
      llmSpan.endSuccess();
      agentSpan.endSuccess();
    });
  });

  describe('withLLMSpan', () => {
    it('should execute function and return result with token recording', async () => {
      const result = await withLLMSpan(
        { modelName: 'claude-3-sonnet' },
        async (span) => {
          expect(span).toBeInstanceOf(SpanWrapper);
          span.addEvent('llm_request_sent');
          return {
            result: 'LLM response content',
            inputTokens: 1000,
            outputTokens: 500,
            costUsd: 0.05,
          };
        }
      );

      expect(result).toBe('LLM response content');
    });

    it('should handle errors and rethrow', async () => {
      await expect(
        withLLMSpan({ modelName: 'claude-3-sonnet' }, async () => {
          throw new Error('API rate limit exceeded');
        })
      ).rejects.toThrow('API rate limit exceeded');
    });

    it('should work with parent context', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      await withAgentSpan(
        {
          agentName: 'worker',
          agentType: 'processor',
        },
        async (agentSpan) => {
          const response = await withLLMSpan(
            { modelName: 'claude-3-sonnet', parentContext: agentSpan.getContext() },
            async () => {
              return {
                result: { content: 'response' },
                inputTokens: 500,
                outputTokens: 200,
              };
            }
          );
          expect(response).toEqual({ content: 'response' });
        }
      );
    });

    it('should not end span twice if already ended', async () => {
      const result = await withLLMSpan(
        { modelName: 'claude-3-sonnet' },
        async (span) => {
          span.recordTokenUsage(100, 50, 0.01);
          span.endSuccess();
          return {
            result: 'ended early',
            inputTokens: 100,
            outputTokens: 50,
          };
        }
      );

      expect(result).toBe('ended early');
    });
  });

  describe('withTracedAgent', () => {
    it('should execute function with token recording callback', async () => {
      const mockMetricsCollector = {
        recordTokenUsage: vi.fn(),
      };

      const result = await withTracedAgent(
        {
          agentName: 'worker',
          agentType: 'processor',
          pipelineStage: 'implementation',
          pipelineMode: 'greenfield',
        },
        mockMetricsCollector,
        async (_span, recordTokens) => {
          recordTokens(1000, 500, 0.05);
          return 'task completed';
        }
      );

      expect(result).toBe('task completed');
      expect(mockMetricsCollector.recordTokenUsage).toHaveBeenCalledWith('worker', 1000, 500);
    });

    it('should work without MetricsCollector (null)', async () => {
      const result = await withTracedAgent(
        {
          agentName: 'worker',
          agentType: 'processor',
        },
        null,
        async (_span, recordTokens) => {
          recordTokens(500, 250);
          return 'done';
        }
      );

      expect(result).toBe('done');
    });

    it('should handle errors and rethrow', async () => {
      const mockMetricsCollector = {
        recordTokenUsage: vi.fn(),
      };

      await expect(
        withTracedAgent(
          {
            agentName: 'worker',
            agentType: 'processor',
          },
          mockMetricsCollector,
          async () => {
            throw new Error('Agent failed');
          }
        )
      ).rejects.toThrow('Agent failed');
    });

    it('should record tokens in both span and MetricsCollector', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const mockMetricsCollector = {
        recordTokenUsage: vi.fn(),
      };

      await withTracedAgent(
        {
          agentName: 'collector',
          agentType: 'analyzer',
          correlationId: 'req-456',
        },
        mockMetricsCollector,
        async (span, recordTokens) => {
          span.addEvent('processing_started');
          recordTokens(2000, 1000, 0.12);
          span.addEvent('processing_completed');
          return 'analysis complete';
        }
      );

      expect(mockMetricsCollector.recordTokenUsage).toHaveBeenCalledWith('collector', 2000, 1000);
    });
  });

  describe('Integration scenarios', () => {
    it('should support nested agent and tool spans', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      await withAgentSpan(
        {
          agentName: 'orchestrator',
          agentType: 'coordinator',
          correlationId: 'req-123',
          pipelineStage: 'planning',
          pipelineMode: 'greenfield',
        },
        async (agentSpan) => {
          // Simulate tool invocation
          await withToolSpan(
            {
              toolName: 'Read',
              parentContext: agentSpan.getContext(),
            },
            async (toolSpan) => {
              toolSpan.addEvent('file_read', { path: '/test/file.ts' });
              return 'file content';
            }
          );

          // Simulate subagent invocation
          const subagentContext = propagateToSubagent(agentSpan, 'task-001');

          await withAgentSpan(
            {
              agentName: 'worker',
              agentType: 'processor',
              correlationId: 'req-123',
              parentToolUseId: 'task-001',
              parentContext: subagentContext,
            },
            async (workerSpan) => {
              workerSpan.recordTokenUsage(1000, 500, 0.05);
              return 'work completed';
            }
          );

          agentSpan.recordTokenUsage(500, 200, 0.02);
        }
      );
    });

    it('should handle complex error propagation', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      await expect(
        withAgentSpan(
          {
            agentName: 'orchestrator',
            agentType: 'coordinator',
          },
          async (agentSpan) => {
            await withToolSpan(
              {
                toolName: 'Write',
                parentContext: agentSpan.getContext(),
              },
              async () => {
                throw new Error('Write failed');
              }
            );
          }
        )
      ).rejects.toThrow('Write failed');
    });

    it('should support nested agent, tool, and LLM spans', async () => {
      const provider = new OpenTelemetryProvider({
        enabled: true,
        serviceName: 'test-service',
        exporters: [{ type: 'console', enabled: true }],
      });
      await provider.initialize();

      const mockMetricsCollector = {
        recordTokenUsage: vi.fn(),
      };

      await withTracedAgent(
        {
          agentName: 'orchestrator',
          agentType: 'coordinator',
          correlationId: 'req-789',
          pipelineStage: 'analysis',
          pipelineMode: 'enhancement',
        },
        mockMetricsCollector,
        async (agentSpan, recordTokens) => {
          // Tool invocation
          await withToolSpan(
            {
              toolName: 'Read',
              parentContext: agentSpan.getContext(),
            },
            async (toolSpan) => {
              toolSpan.addEvent('file_read', { path: '/src/main.ts' });
              return 'file content';
            }
          );

          // LLM call
          const analysis = await withLLMSpan(
            { modelName: 'claude-3-opus', parentContext: agentSpan.getContext() },
            async (llmSpan) => {
              llmSpan.addEvent('llm_request_sent');
              return {
                result: { suggestion: 'refactor this function' },
                inputTokens: 3000,
                outputTokens: 1500,
                costUsd: 0.25,
              };
            }
          );

          expect(analysis).toEqual({ suggestion: 'refactor this function' });

          // Record total agent token usage
          recordTokens(3000, 1500, 0.25);

          return 'orchestration complete';
        }
      );

      expect(mockMetricsCollector.recordTokenUsage).toHaveBeenCalledWith('orchestrator', 3000, 1500);
    });
  });
});
