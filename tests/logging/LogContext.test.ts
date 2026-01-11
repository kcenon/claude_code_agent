import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LogContext,
  getLogContext,
  runWithContext,
  withSpan,
  withAgent,
  getCurrentCorrelationId,
  getCurrentTraceContext,
  generateCorrelationId,
} from '../../src/logging/LogContext.js';
import type { AgentContext, TraceContext } from '../../src/logging/LogContext.js';

describe('LogContext', () => {
  beforeEach(() => {
    LogContext.resetInstance();
  });

  afterEach(() => {
    LogContext.resetInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = LogContext.getInstance();
      const instance2 = LogContext.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = LogContext.getInstance();
      LogContext.resetInstance();
      const instance2 = LogContext.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('run', () => {
    it('should create context with correlation ID', () => {
      const logContext = LogContext.getInstance();

      logContext.run({ correlationId: 'test-correlation-123' }, () => {
        expect(logContext.getCorrelationId()).toBe('test-correlation-123');
      });
    });

    it('should generate correlation ID if not provided', () => {
      const logContext = LogContext.getInstance();

      logContext.run({}, () => {
        const correlationId = logContext.getCorrelationId();
        expect(correlationId).toBeDefined();
        expect(correlationId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
      });
    });

    it('should generate session ID if not provided', () => {
      const logContext = LogContext.getInstance();

      logContext.run({}, () => {
        const sessionId = logContext.getSessionId();
        expect(sessionId).toBeDefined();
        expect(sessionId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
      });
    });

    it('should return undefined outside of context', () => {
      const logContext = LogContext.getInstance();

      expect(logContext.getCorrelationId()).toBeUndefined();
      expect(logContext.getSessionId()).toBeUndefined();
      expect(logContext.getContext()).toBeUndefined();
    });

    it('should support async callbacks', async () => {
      const logContext = LogContext.getInstance();

      await logContext.run({ correlationId: 'async-test' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(logContext.getCorrelationId()).toBe('async-test');
      });
    });

    it('should preserve context across async operations', async () => {
      const logContext = LogContext.getInstance();

      await logContext.run({ correlationId: 'preserved-test' }, async () => {
        expect(logContext.getCorrelationId()).toBe('preserved-test');

        await Promise.all([
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            expect(logContext.getCorrelationId()).toBe('preserved-test');
          })(),
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(logContext.getCorrelationId()).toBe('preserved-test');
          })(),
        ]);
      });
    });
  });

  describe('runWithInherit', () => {
    it('should inherit context from parent', () => {
      const logContext = LogContext.getInstance();

      logContext.run({ correlationId: 'parent-id', sessionId: 'session-1' }, () => {
        logContext.runWithInherit({}, () => {
          expect(logContext.getCorrelationId()).toBe('parent-id');
          expect(logContext.getSessionId()).toBe('session-1');
        });
      });
    });

    it('should override inherited values when provided', () => {
      const logContext = LogContext.getInstance();

      logContext.run({ correlationId: 'parent-id' }, () => {
        logContext.runWithInherit({ correlationId: 'child-id' }, () => {
          expect(logContext.getCorrelationId()).toBe('child-id');
        });
      });
    });

    it('should merge metadata from parent and child', () => {
      const logContext = LogContext.getInstance();

      logContext.run({ metadata: { parent: 'value' } }, () => {
        logContext.runWithInherit({ metadata: { child: 'value' } }, () => {
          const context = logContext.getContext();
          expect(context?.metadata).toEqual({
            parent: 'value',
            child: 'value',
          });
        });
      });
    });
  });

  describe('withSpan', () => {
    it('should create trace context if none exists', () => {
      const logContext = LogContext.getInstance();

      logContext.withSpan({ name: 'test-span' }, () => {
        const trace = logContext.getTraceContext();
        expect(trace).toBeDefined();
        expect(trace?.traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(trace?.spanId).toMatch(/^[0-9a-f]{16}$/);
        expect(trace?.parentSpanId).toBeUndefined();
      });
    });

    it('should create child span with parent reference', () => {
      const logContext = LogContext.getInstance();

      logContext.run(
        {
          trace: {
            traceId: 'aaaabbbbccccdddd1111222233334444',
            spanId: '1111222233334444',
          },
        },
        () => {
          const parentSpanId = logContext.getTraceContext()?.spanId;

          logContext.withSpan({ name: 'child-span' }, () => {
            const trace = logContext.getTraceContext();
            expect(trace?.traceId).toBe('aaaabbbbccccdddd1111222233334444');
            expect(trace?.spanId).not.toBe(parentSpanId);
            expect(trace?.parentSpanId).toBe(parentSpanId);
          });
        }
      );
    });

    it('should preserve trace ID across nested spans', () => {
      const logContext = LogContext.getInstance();

      logContext.withSpan({ name: 'span-1' }, () => {
        const traceId = logContext.getTraceContext()?.traceId;

        logContext.withSpan({ name: 'span-2' }, () => {
          expect(logContext.getTraceContext()?.traceId).toBe(traceId);

          logContext.withSpan({ name: 'span-3' }, () => {
            expect(logContext.getTraceContext()?.traceId).toBe(traceId);
          });
        });
      });
    });

    it('should add span name to metadata', () => {
      const logContext = LogContext.getInstance();

      logContext.withSpan({ name: 'named-span', metadata: { extra: 'data' } }, () => {
        const context = logContext.getContext();
        expect(context?.metadata?.spanName).toBe('named-span');
        expect(context?.metadata?.extra).toBe('data');
      });
    });
  });

  describe('withAgent', () => {
    it('should set agent context', () => {
      const logContext = LogContext.getInstance();

      const agent: AgentContext = {
        agentId: 'prd-writer',
        stage: 'document-generation',
        projectId: 'project-123',
      };

      logContext.withAgent(agent, () => {
        const agentContext = logContext.getAgentContext();
        expect(agentContext).toEqual(agent);
      });
    });

    it('should create new context if none exists', () => {
      const logContext = LogContext.getInstance();

      logContext.withAgent({ agentId: 'test-agent' }, () => {
        expect(logContext.hasContext()).toBe(true);
        expect(logContext.getAgentContext()?.agentId).toBe('test-agent');
      });
    });

    it('should override agent context in nested call', () => {
      const logContext = LogContext.getInstance();

      logContext.withAgent({ agentId: 'outer-agent' }, () => {
        expect(logContext.getAgentContext()?.agentId).toBe('outer-agent');

        logContext.withAgent({ agentId: 'inner-agent' }, () => {
          expect(logContext.getAgentContext()?.agentId).toBe('inner-agent');
        });

        expect(logContext.getAgentContext()?.agentId).toBe('outer-agent');
      });
    });
  });

  describe('withMetadata', () => {
    it('should add metadata to context', () => {
      const logContext = LogContext.getInstance();

      logContext.withMetadata({ key: 'value', count: 42 }, () => {
        const context = logContext.getContext();
        expect(context?.metadata).toEqual({ key: 'value', count: 42 });
      });
    });

    it('should merge with existing metadata', () => {
      const logContext = LogContext.getInstance();

      logContext.run({ metadata: { existing: 'value' } }, () => {
        logContext.withMetadata({ new: 'data' }, () => {
          const context = logContext.getContext();
          expect(context?.metadata).toEqual({
            existing: 'value',
            new: 'data',
          });
        });
      });
    });
  });

  describe('hasContext', () => {
    it('should return false outside of context', () => {
      const logContext = LogContext.getInstance();
      expect(logContext.hasContext()).toBe(false);
    });

    it('should return true inside context', () => {
      const logContext = LogContext.getInstance();

      logContext.run({}, () => {
        expect(logContext.hasContext()).toBe(true);
      });
    });
  });

  describe('getLogEntryContext', () => {
    it('should return empty object outside of context', () => {
      const logContext = LogContext.getInstance();
      expect(logContext.getLogEntryContext()).toEqual({});
    });

    it('should return flattened context for log entries', () => {
      const logContext = LogContext.getInstance();

      logContext.run(
        {
          correlationId: 'corr-123',
          sessionId: 'sess-456',
          trace: {
            traceId: 'trace-789',
            spanId: 'span-abc',
            parentSpanId: 'span-parent',
          },
          agent: {
            agentId: 'test-agent',
            stage: 'testing',
            projectId: 'proj-1',
          },
        },
        () => {
          const entryContext = logContext.getLogEntryContext();

          expect(entryContext).toEqual({
            correlationId: 'corr-123',
            sessionId: 'sess-456',
            traceId: 'trace-789',
            spanId: 'span-abc',
            parentSpanId: 'span-parent',
            agentId: 'test-agent',
            stage: 'testing',
            projectId: 'proj-1',
          });
        }
      );
    });

    it('should omit undefined optional fields', () => {
      const logContext = LogContext.getInstance();

      logContext.run(
        {
          correlationId: 'corr-123',
          agent: {
            agentId: 'test-agent',
          },
        },
        () => {
          const entryContext = logContext.getLogEntryContext();

          expect(entryContext).toHaveProperty('correlationId');
          expect(entryContext).toHaveProperty('agentId');
          expect(entryContext).not.toHaveProperty('stage');
          expect(entryContext).not.toHaveProperty('projectId');
          expect(entryContext).not.toHaveProperty('traceId');
        }
      );
    });
  });

  describe('convenience functions', () => {
    it('getLogContext should return singleton', () => {
      const context1 = getLogContext();
      const context2 = getLogContext();
      expect(context1).toBe(context2);
    });

    it('runWithContext should work like LogContext.run', () => {
      runWithContext({ correlationId: 'convenience-test' }, () => {
        expect(getCurrentCorrelationId()).toBe('convenience-test');
      });
    });

    it('withSpan should create trace context', () => {
      withSpan({ name: 'test-span' }, () => {
        const trace = getCurrentTraceContext();
        expect(trace).toBeDefined();
        expect(trace?.traceId).toBeDefined();
        expect(trace?.spanId).toBeDefined();
      });
    });

    it('withAgent should set agent context', () => {
      withAgent({ agentId: 'helper-agent' }, () => {
        const context = getLogContext().getAgentContext();
        expect(context?.agentId).toBe('helper-agent');
      });
    });

    it('getCurrentCorrelationId should return undefined outside context', () => {
      expect(getCurrentCorrelationId()).toBeUndefined();
    });

    it('getCurrentTraceContext should return undefined outside context', () => {
      expect(getCurrentTraceContext()).toBeUndefined();
    });

    it('generateCorrelationId should return valid UUID', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe('context isolation', () => {
    it('should isolate contexts between parallel runs', async () => {
      const logContext = LogContext.getInstance();
      const results: string[] = [];

      await Promise.all([
        logContext.run({ correlationId: 'run-1' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          results.push(`1: ${logContext.getCorrelationId()}`);
        }),
        logContext.run({ correlationId: 'run-2' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          results.push(`2: ${logContext.getCorrelationId()}`);
        }),
      ]);

      expect(results).toContain('1: run-1');
      expect(results).toContain('2: run-2');
    });

    it('should not leak context to outer scope', () => {
      const logContext = LogContext.getInstance();

      expect(logContext.getCorrelationId()).toBeUndefined();

      logContext.run({ correlationId: 'inner' }, () => {
        expect(logContext.getCorrelationId()).toBe('inner');
      });

      expect(logContext.getCorrelationId()).toBeUndefined();
    });
  });
});
