/**
 * LogContext - Context propagation for distributed tracing and correlation
 *
 * This module provides AsyncLocalStorage-based context propagation for
 * automatic correlation ID and trace context management across async calls.
 *
 * Features:
 * - AsyncLocalStorage-based automatic context propagation
 * - Correlation ID generation and management
 * - Distributed tracing with trace ID, span ID, parent span ID
 * - Agent context tracking
 * - Sensitive data masking patterns
 *
 * @module logging
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Trace context for distributed tracing
 */
export interface TraceContext {
  /** Unique trace identifier spanning all related operations */
  readonly traceId: string;
  /** Current span identifier */
  readonly spanId: string;
  /** Parent span identifier for nested operations */
  readonly parentSpanId?: string | undefined;
}

/**
 * Agent context for tracking agent-specific information
 */
export interface AgentContext {
  /** Agent identifier (e.g., 'prd-writer', 'worker') */
  readonly agentId: string;
  /** Current pipeline stage */
  readonly stage?: string | undefined;
  /** Project identifier */
  readonly projectId?: string | undefined;
}

/**
 * Complete log context structure
 */
export interface LogContextData {
  /** Correlation ID for request tracing */
  readonly correlationId: string;
  /** Session ID for session-based grouping */
  readonly sessionId: string;
  /** Trace context for distributed tracing */
  readonly trace?: TraceContext | undefined;
  /** Agent context for agent-specific tracking */
  readonly agent?: AgentContext | undefined;
  /** Custom metadata */
  readonly metadata?: Record<string, unknown> | undefined;
  /** Timestamp when context was created */
  readonly createdAt: Date;
}

/**
 * Options for creating a new context
 */
export interface CreateContextOptions {
  /** Correlation ID (generated if not provided) */
  correlationId?: string | undefined;
  /** Session ID (generated if not provided) */
  sessionId?: string | undefined;
  /** Initial trace context */
  trace?: Partial<TraceContext> | undefined;
  /** Initial agent context */
  agent?: Partial<AgentContext> | undefined;
  /** Custom metadata */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Options for creating a child span
 */
export interface CreateSpanOptions {
  /** Span name for identification */
  name?: string | undefined;
  /** Additional metadata for this span */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Generate a random span ID (16 hex characters)
 */
function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').substring(0, 16);
}

/**
 * Generate a random trace ID (32 hex characters)
 */
function generateTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

/**
 * LogContext - Manages context propagation using AsyncLocalStorage
 *
 * This class provides automatic context propagation across async calls,
 * enabling correlation ID and trace context to be automatically included
 * in all log entries without explicit passing.
 *
 * @example
 * ```typescript
 * const logContext = LogContext.getInstance();
 *
 * // Run code within a context
 * await logContext.run({ correlationId: 'req-123' }, async () => {
 *   // All logs within this block will include correlationId: 'req-123'
 *   logger.info('Processing request');
 *
 *   // Create a child span for nested operations
 *   await logContext.withSpan({ name: 'db-query' }, async () => {
 *     logger.info('Executing database query');
 *   });
 * });
 * ```
 */
export class LogContext {
  private static instance: LogContext | null = null;
  private readonly storage: AsyncLocalStorage<LogContextData>;

  private constructor() {
    this.storage = new AsyncLocalStorage<LogContextData>();
  }

  /**
   * Get the singleton LogContext instance
   */
  public static getInstance(): LogContext {
    if (LogContext.instance === null) {
      LogContext.instance = new LogContext();
    }
    return LogContext.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static resetInstance(): void {
    LogContext.instance = null;
  }

  /**
   * Get the current context
   *
   * @returns Current context or undefined if not in a context
   */
  public getContext(): LogContextData | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current correlation ID
   *
   * @returns Correlation ID or undefined if not in a context
   */
  public getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  /**
   * Get the current session ID
   *
   * @returns Session ID or undefined if not in a context
   */
  public getSessionId(): string | undefined {
    return this.storage.getStore()?.sessionId;
  }

  /**
   * Get the current trace context
   *
   * @returns Trace context or undefined if not set
   */
  public getTraceContext(): TraceContext | undefined {
    return this.storage.getStore()?.trace;
  }

  /**
   * Get the current agent context
   *
   * @returns Agent context or undefined if not set
   */
  public getAgentContext(): AgentContext | undefined {
    return this.storage.getStore()?.agent;
  }

  /**
   * Check if currently running within a context
   */
  public hasContext(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /**
   * Run a callback within a new context
   *
   * @param options - Context creation options
   * @param callback - Callback to run within the context
   * @returns Result of the callback
   *
   * @example
   * ```typescript
   * await logContext.run({ correlationId: 'req-123' }, async () => {
   *   logger.info('Processing request');
   * });
   * ```
   */
  public run<T>(options: CreateContextOptions, callback: () => T): T {
    const context = this.createContext(options);
    return this.storage.run(context, callback);
  }

  /**
   * Run a callback within a new context, inheriting from current context if available
   *
   * @param options - Context creation options (will override inherited values)
   * @param callback - Callback to run within the context
   * @returns Result of the callback
   */
  public runWithInherit<T>(options: Partial<CreateContextOptions>, callback: () => T): T {
    const currentContext = this.storage.getStore();
    const newContext = this.createContext({
      correlationId: options.correlationId ?? currentContext?.correlationId,
      sessionId: options.sessionId ?? currentContext?.sessionId,
      trace: options.trace ?? currentContext?.trace,
      agent: options.agent ?? currentContext?.agent,
      metadata: {
        ...currentContext?.metadata,
        ...options.metadata,
      },
    });
    return this.storage.run(newContext, callback);
  }

  /**
   * Create a child span within the current context
   *
   * @param options - Span creation options
   * @param callback - Callback to run within the span
   * @returns Result of the callback
   *
   * @example
   * ```typescript
   * await logContext.withSpan({ name: 'process-data' }, async () => {
   *   logger.info('Processing data');
   * });
   * ```
   */
  public withSpan<T>(options: CreateSpanOptions, callback: () => T): T {
    const currentContext = this.storage.getStore();

    if (currentContext === undefined) {
      // Create a new context with trace if none exists
      return this.run(
        {
          trace: {
            traceId: generateTraceId(),
            spanId: generateSpanId(),
          },
          metadata: {
            ...options.metadata,
            spanName: options.name,
          },
        },
        callback
      );
    }

    const parentSpanId = currentContext.trace?.spanId;
    const traceId = currentContext.trace?.traceId ?? generateTraceId();

    const newContext: LogContextData = {
      ...currentContext,
      trace: {
        traceId,
        spanId: generateSpanId(),
        parentSpanId,
      },
      metadata: {
        ...currentContext.metadata,
        ...options.metadata,
        spanName: options.name,
      },
      createdAt: new Date(),
    };

    return this.storage.run(newContext, callback);
  }

  /**
   * Set agent context within the current context
   *
   * @param agent - Agent context to set
   * @param callback - Callback to run with the agent context
   * @returns Result of the callback
   *
   * @example
   * ```typescript
   * await logContext.withAgent({
   *   agentId: 'prd-writer',
   *   stage: 'document-generation',
   *   projectId: 'project-123'
   * }, async () => {
   *   logger.info('Agent processing');
   * });
   * ```
   */
  public withAgent<T>(agent: AgentContext, callback: () => T): T {
    const currentContext = this.storage.getStore();

    if (currentContext === undefined) {
      return this.run({ agent }, callback);
    }

    const newContext: LogContextData = {
      ...currentContext,
      agent,
      createdAt: new Date(),
    };

    return this.storage.run(newContext, callback);
  }

  /**
   * Add metadata to the current context
   *
   * @param metadata - Metadata to add
   * @param callback - Callback to run with the metadata
   * @returns Result of the callback
   */
  public withMetadata<T>(metadata: Record<string, unknown>, callback: () => T): T {
    const currentContext = this.storage.getStore();

    if (currentContext === undefined) {
      return this.run({ metadata }, callback);
    }

    const newContext: LogContextData = {
      ...currentContext,
      metadata: {
        ...currentContext.metadata,
        ...metadata,
      },
      createdAt: new Date(),
    };

    return this.storage.run(newContext, callback);
  }

  /**
   * Create a new context from options
   * @param options
   */
  private createContext(options: CreateContextOptions): LogContextData {
    const traceId = options.trace?.traceId ?? generateTraceId();
    const spanId = options.trace?.spanId ?? generateSpanId();

    const context: LogContextData = {
      correlationId: options.correlationId ?? randomUUID(),
      sessionId: options.sessionId ?? randomUUID(),
      createdAt: new Date(),
    };

    // Add trace context if any trace options provided
    if (options.trace !== undefined) {
      (context as { trace: TraceContext }).trace = {
        traceId,
        spanId,
        parentSpanId: options.trace.parentSpanId,
      };
    }

    // Add agent context if provided
    if (options.agent !== undefined && options.agent.agentId !== undefined) {
      (context as { agent: AgentContext }).agent = {
        agentId: options.agent.agentId,
        stage: options.agent.stage,
        projectId: options.agent.projectId,
      };
    }

    // Add metadata if provided
    if (options.metadata !== undefined) {
      (context as { metadata: Record<string, unknown> }).metadata = options.metadata;
    }

    return context;
  }

  /**
   * Extract context data suitable for log entries
   *
   * @returns Flattened context data for log entries
   */
  public getLogEntryContext(): Record<string, unknown> {
    const context = this.storage.getStore();

    if (context === undefined) {
      return {};
    }

    const result: Record<string, unknown> = {
      correlationId: context.correlationId,
      sessionId: context.sessionId,
    };

    if (context.trace !== undefined) {
      result['traceId'] = context.trace.traceId;
      result['spanId'] = context.trace.spanId;
      if (context.trace.parentSpanId !== undefined) {
        result['parentSpanId'] = context.trace.parentSpanId;
      }
    }

    if (context.agent !== undefined) {
      result['agentId'] = context.agent.agentId;
      if (context.agent.stage !== undefined) {
        result['stage'] = context.agent.stage;
      }
      if (context.agent.projectId !== undefined) {
        result['projectId'] = context.agent.projectId;
      }
    }

    return result;
  }
}

/**
 * Get the global LogContext instance
 */
export function getLogContext(): LogContext {
  return LogContext.getInstance();
}

/**
 * Convenience function to run code within a context
 *
 * @param options - Context creation options
 * @param callback - Callback to run within the context
 * @returns Result of the callback
 *
 * @example
 * ```typescript
 * await runWithContext({ correlationId: 'req-123' }, async () => {
 *   logger.info('Processing');
 * });
 * ```
 */
export function runWithContext<T>(options: CreateContextOptions, callback: () => T): T {
  return LogContext.getInstance().run(options, callback);
}

/**
 * Convenience function to run code within a child span
 *
 * @param options - Span creation options
 * @param callback - Callback to run within the span
 * @returns Result of the callback
 *
 * @example
 * ```typescript
 * await withSpan({ name: 'db-query' }, async () => {
 *   // Query database
 * });
 * ```
 */
export function withSpan<T>(options: CreateSpanOptions, callback: () => T): T {
  return LogContext.getInstance().withSpan(options, callback);
}

/**
 * Convenience function to run code with agent context
 *
 * @param agent - Agent context
 * @param callback - Callback to run
 * @returns Result of the callback
 */
export function withAgent<T>(agent: AgentContext, callback: () => T): T {
  return LogContext.getInstance().withAgent(agent, callback);
}

/**
 * Get the current correlation ID from context
 *
 * @returns Correlation ID or undefined
 */
export function getCurrentCorrelationId(): string | undefined {
  return LogContext.getInstance().getCorrelationId();
}

/**
 * Get the current trace context
 *
 * @returns Trace context or undefined
 */
export function getCurrentTraceContext(): TraceContext | undefined {
  return LogContext.getInstance().getTraceContext();
}

/**
 * Generate a new correlation ID
 *
 * @returns New UUID correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}
