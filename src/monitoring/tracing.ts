/**
 * Tracing utilities for span instrumentation
 *
 * Provides helper functions for automatic instrumentation of agents and tools,
 * with span context propagation across subagents.
 *
 * @packageDocumentation
 */

import { context, type Context, type Span, trace } from '@opentelemetry/api';
import { getOpenTelemetryProvider } from './OpenTelemetryProvider.js';
import { ADSDLC_SPAN_ATTRIBUTES, type PipelineMode } from './types.js';

/**
 * Options for starting an agent span
 */
export interface AgentSpanOptions {
  /** Agent name */
  readonly agentName: string;
  /** Agent type (e.g., 'processor', 'analyzer') */
  readonly agentType: string;
  /** Correlation ID for tracing */
  readonly correlationId?: string;
  /** Parent tool use ID for subagent correlation */
  readonly parentToolUseId?: string;
  /** Pipeline stage */
  readonly pipelineStage?: string;
  /** Pipeline mode (greenfield/enhancement) */
  readonly pipelineMode?: PipelineMode;
  /** Parent context for span hierarchy */
  readonly parentContext?: Context;
}

/**
 * Options for starting a tool span
 */
export interface ToolSpanOptions {
  /** Tool name */
  readonly toolName: string;
  /** Parent context for span hierarchy */
  readonly parentContext?: Context;
}

/**
 * Options for starting an LLM span
 */
export interface LLMSpanOptions {
  /** Model name (e.g., 'claude-3-sonnet', 'claude-3-opus') */
  readonly modelName: string;
  /** Parent context for span hierarchy */
  readonly parentContext?: Context;
}

/**
 * LLM call result with token usage information
 */
export interface LLMCallResult<T> {
  /** The actual result from the LLM call */
  readonly result: T;
  /** Number of input tokens used */
  readonly inputTokens: number;
  /** Number of output tokens generated */
  readonly outputTokens: number;
  /** Optional cost in USD */
  readonly costUsd?: number;
}

/**
 * Result of a tool invocation for recording
 */
export interface ToolResult {
  /** Whether the tool succeeded */
  readonly success: boolean;
  /** Result summary or error message */
  readonly result?: string;
  /** Error if tool failed */
  readonly error?: Error;
}

/**
 * Span wrapper that provides a convenient API for span lifecycle management
 */
export class SpanWrapper {
  private readonly span: Span | null;
  private ended = false;

  constructor(span: Span | null) {
    this.span = span;
  }

  /**
   * Get the underlying span (may be null if tracing is disabled)
   */
  public getSpan(): Span | null {
    return this.span;
  }

  /**
   * Get the context for this span (for creating child spans)
   */
  public getContext(): Context {
    if (this.span === null) {
      return context.active();
    }
    return trace.setSpan(context.active(), this.span);
  }

  /**
   * Set an attribute on the span
   */
  public setAttribute(key: string, value: string | number | boolean): this {
    this.span?.setAttribute(key, value);
    return this;
  }

  /**
   * Set multiple attributes on the span
   */
  public setAttributes(attributes: Record<string, string | number | boolean>): this {
    if (this.span !== null) {
      for (const [key, value] of Object.entries(attributes)) {
        this.span.setAttribute(key, value);
      }
    }
    return this;
  }

  /**
   * Add an event to the span
   */
  public addEvent(name: string, attributes?: Record<string, string | number | boolean>): this {
    this.span?.addEvent(name, attributes);
    return this;
  }

  /**
   * Record token usage on the span
   */
  public recordTokenUsage(inputTokens: number, outputTokens: number, costUsd?: number): this {
    if (this.span !== null) {
      this.span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOKENS_INPUT, inputTokens);
      this.span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOKENS_OUTPUT, outputTokens);
      if (costUsd !== undefined) {
        this.span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOKENS_COST, costUsd);
      }
    }
    return this;
  }

  /**
   * End the span with success status
   */
  public endSuccess(attributes?: Record<string, string | number>): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    getOpenTelemetryProvider().endSpanSuccess(this.span, attributes);
  }

  /**
   * End the span with error status
   */
  public endError(error: Error): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    getOpenTelemetryProvider().endSpanError(this.span, error);
  }

  /**
   * Check if the span has been ended
   */
  public isEnded(): boolean {
    return this.ended;
  }
}

/**
 * Start a span for agent execution with all relevant attributes
 *
 * @param options - Agent span options
 * @returns SpanWrapper for managing the span lifecycle
 *
 * @example
 * ```typescript
 * const span = startAgentSpan({
 *   agentName: 'worker',
 *   agentType: 'processor',
 *   correlationId: 'uuid-123',
 *   pipelineStage: 'implementation',
 *   pipelineMode: 'greenfield'
 * });
 *
 * try {
 *   // Agent execution logic
 *   span.recordTokenUsage(1000, 500, 0.05);
 *   span.endSuccess();
 * } catch (error) {
 *   span.endError(error instanceof Error ? error : new Error(String(error)));
 *   throw error;
 * }
 * ```
 */
export function startAgentSpan(options: AgentSpanOptions): SpanWrapper {
  const provider = getOpenTelemetryProvider();

  const span = provider.startSpan(
    `agent:${options.agentName}`,
    {
      attributes: {
        [ADSDLC_SPAN_ATTRIBUTES.AGENT_NAME]: options.agentName,
        [ADSDLC_SPAN_ATTRIBUTES.AGENT_TYPE]: options.agentType,
      },
    },
    options.parentContext
  );

  const wrapper = new SpanWrapper(span);

  // Set optional attributes
  if (options.correlationId !== undefined) {
    wrapper.setAttribute(ADSDLC_SPAN_ATTRIBUTES.CORRELATION_ID, options.correlationId);
  }

  if (options.parentToolUseId !== undefined) {
    wrapper.setAttribute(ADSDLC_SPAN_ATTRIBUTES.PARENT_TOOL_USE_ID, options.parentToolUseId);
  }

  if (options.pipelineStage !== undefined) {
    wrapper.setAttribute(ADSDLC_SPAN_ATTRIBUTES.PIPELINE_STAGE, options.pipelineStage);
  }

  if (options.pipelineMode !== undefined) {
    wrapper.setAttribute(ADSDLC_SPAN_ATTRIBUTES.PIPELINE_MODE, options.pipelineMode);
  }

  return wrapper;
}

/**
 * Start a span for tool invocation
 *
 * @param options - Tool span options
 * @returns SpanWrapper for managing the span lifecycle
 *
 * @example
 * ```typescript
 * const toolSpan = startToolSpan({ toolName: 'Read', parentContext: agentSpan.getContext() });
 *
 * try {
 *   const result = await readFile(path);
 *   toolSpan.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT, 'success');
 *   toolSpan.endSuccess();
 *   return result;
 * } catch (error) {
 *   toolSpan.endError(error instanceof Error ? error : new Error(String(error)));
 *   throw error;
 * }
 * ```
 */
export function startToolSpan(options: ToolSpanOptions): SpanWrapper {
  const provider = getOpenTelemetryProvider();

  const span = provider.startSpan(
    `tool:${options.toolName}`,
    {
      attributes: {
        [ADSDLC_SPAN_ATTRIBUTES.TOOL_NAME]: options.toolName,
      },
    },
    options.parentContext
  );

  return new SpanWrapper(span);
}

/**
 * Record tool result on a span and end it appropriately
 *
 * @param span - SpanWrapper to record result on
 * @param result - Tool invocation result
 */
export function recordToolResult(span: SpanWrapper, result: ToolResult): void {
  if (result.success) {
    if (result.result !== undefined) {
      span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT, result.result);
    } else {
      span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT, 'success');
    }
    span.endSuccess();
  } else {
    span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT, 'error');
    if (result.error !== undefined) {
      span.endError(result.error);
    } else {
      span.endError(new Error(result.result ?? 'Unknown error'));
    }
  }
}

/**
 * Execute a function within an agent span context
 *
 * This helper automatically manages span lifecycle including error handling.
 *
 * @param options - Agent span options
 * @param fn - Function to execute within the span
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await withAgentSpan(
 *   {
 *     agentName: 'collector',
 *     agentType: 'analyzer',
 *     correlationId: 'uuid-123'
 *   },
 *   async (span) => {
 *     // Perform agent work
 *     span.addEvent('processing_started');
 *     const data = await processData();
 *     span.recordTokenUsage(data.inputTokens, data.outputTokens);
 *     return data.result;
 *   }
 * );
 * ```
 */
export async function withAgentSpan<T>(
  options: AgentSpanOptions,
  fn: (span: SpanWrapper) => Promise<T>
): Promise<T> {
  const span = startAgentSpan(options);

  try {
    const result = await fn(span);
    if (!span.isEnded()) {
      span.endSuccess();
    }
    return result;
  } catch (error) {
    if (!span.isEnded()) {
      span.endError(error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  }
}

/**
 * Execute a function within a tool span context
 *
 * This helper automatically manages span lifecycle including error handling.
 *
 * @param options - Tool span options
 * @param fn - Function to execute within the span
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const content = await withToolSpan(
 *   { toolName: 'Read', parentContext: agentSpan.getContext() },
 *   async (span) => {
 *     span.addEvent('reading_file', { path: filePath });
 *     const content = await readFile(filePath);
 *     span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT, 'success');
 *     return content;
 *   }
 * );
 * ```
 */
export async function withToolSpan<T>(
  options: ToolSpanOptions,
  fn: (span: SpanWrapper) => Promise<T>
): Promise<T> {
  const span = startToolSpan(options);

  try {
    const result = await fn(span);
    if (!span.isEnded()) {
      span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT, 'success');
      span.endSuccess();
    }
    return result;
  } catch (error) {
    if (!span.isEnded()) {
      span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOOL_RESULT, 'error');
      span.endError(error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  }
}

/**
 * Propagate span context to a subagent via parent tool use ID
 *
 * Use this to establish parent-child relationships between agents.
 *
 * @param parentSpan - Parent agent's span
 * @param toolUseId - Tool use ID for the subagent invocation
 * @returns Context for the subagent
 *
 * @example
 * ```typescript
 * const parentSpan = startAgentSpan({ agentName: 'orchestrator', agentType: 'coordinator' });
 *
 * // When invoking a subagent
 * const subagentContext = propagateToSubagent(parentSpan, 'tool-use-123');
 *
 * // Pass context to subagent
 * const childSpan = startAgentSpan({
 *   agentName: 'worker',
 *   agentType: 'processor',
 *   parentToolUseId: 'tool-use-123',
 *   parentContext: subagentContext
 * });
 * ```
 */
export function propagateToSubagent(parentSpan: SpanWrapper, toolUseId: string): Context {
  parentSpan.addEvent('subagent_invocation', {
    [ADSDLC_SPAN_ATTRIBUTES.PARENT_TOOL_USE_ID]: toolUseId,
  });
  return parentSpan.getContext();
}

/**
 * Get current active span context for manual propagation
 *
 * @returns Current context or default context if no active span
 */
export function getCurrentContext(): Context {
  return context.active();
}

/**
 * Run a function within a specific context
 *
 * @param ctx - Context to use
 * @param fn - Function to execute
 * @returns Result of the function
 */
export function runInContext<T>(ctx: Context, fn: () => T): T {
  return context.with(ctx, fn);
}

/**
 * Run an async function within a specific context
 *
 * @param ctx - Context to use
 * @param fn - Async function to execute
 * @returns Promise of the function result
 */
export async function runInContextAsync<T>(ctx: Context, fn: () => Promise<T>): Promise<T> {
  return context.with(ctx, fn);
}

/**
 * Start a span for LLM API call
 *
 * @param options - LLM span options
 * @returns SpanWrapper for managing the span lifecycle
 *
 * @example
 * ```typescript
 * const llmSpan = startLLMSpan({
 *   modelName: 'claude-3-sonnet',
 *   parentContext: agentSpan.getContext()
 * });
 *
 * try {
 *   const response = await callLLMAPI(prompt);
 *   llmSpan.recordTokenUsage(response.inputTokens, response.outputTokens, response.cost);
 *   llmSpan.endSuccess();
 *   return response;
 * } catch (error) {
 *   llmSpan.endError(error instanceof Error ? error : new Error(String(error)));
 *   throw error;
 * }
 * ```
 */
export function startLLMSpan(options: LLMSpanOptions): SpanWrapper {
  const provider = getOpenTelemetryProvider();

  const span = provider.startSpan(
    `llm:${options.modelName}`,
    {
      attributes: {
        [ADSDLC_SPAN_ATTRIBUTES.MODEL_NAME]: options.modelName,
      },
    },
    options.parentContext
  );

  return new SpanWrapper(span);
}

/**
 * Execute an LLM call within a span context with automatic token usage recording
 *
 * This helper automatically manages span lifecycle including error handling
 * and token usage recording from the LLM response.
 *
 * @param options - LLM span options
 * @param fn - Function that performs the LLM call and returns result with token usage
 * @returns Result of the LLM call (without token metadata)
 *
 * @example
 * ```typescript
 * const response = await withLLMSpan(
 *   { modelName: 'claude-3-sonnet', parentContext: agentSpan.getContext() },
 *   async (span) => {
 *     span.addEvent('llm_request_sent');
 *     const apiResponse = await anthropic.messages.create({
 *       model: 'claude-3-sonnet-20240229',
 *       messages: [{ role: 'user', content: prompt }]
 *     });
 *     return {
 *       result: apiResponse.content,
 *       inputTokens: apiResponse.usage.input_tokens,
 *       outputTokens: apiResponse.usage.output_tokens,
 *       costUsd: calculateCost(apiResponse.usage)
 *     };
 *   }
 * );
 * ```
 */
export async function withLLMSpan<T>(
  options: LLMSpanOptions,
  fn: (span: SpanWrapper) => Promise<LLMCallResult<T>>
): Promise<T> {
  const span = startLLMSpan(options);

  try {
    const callResult = await fn(span);

    // Record token usage from the LLM response
    span.recordTokenUsage(callResult.inputTokens, callResult.outputTokens, callResult.costUsd);

    if (!span.isEnded()) {
      span.endSuccess();
    }
    return callResult.result;
  } catch (error) {
    if (!span.isEnded()) {
      span.endError(error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  }
}

/**
 * Create a traced agent span that integrates with MetricsCollector
 *
 * This is a higher-level helper that combines OpenTelemetry tracing with
 * MetricsCollector for unified observability.
 *
 * @param options - Agent span options
 * @param metricsCollector - Optional MetricsCollector instance for metrics integration
 * @param fn - Function to execute within the span
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * import { getMetricsCollector } from './MetricsCollector.js';
 *
 * const result = await withTracedAgent(
 *   {
 *     agentName: 'worker',
 *     agentType: 'processor',
 *     pipelineStage: 'implementation',
 *     pipelineMode: 'greenfield'
 *   },
 *   getMetricsCollector(),
 *   async (span, recordTokens) => {
 *     const response = await processWithLLM();
 *     recordTokens(response.inputTokens, response.outputTokens);
 *     return response.result;
 *   }
 * );
 * ```
 */
export async function withTracedAgent<T>(
  options: AgentSpanOptions,
  metricsCollector: {
    recordTokenUsage: (agent: string, input: number, output: number) => void;
  } | null,
  fn: (
    span: SpanWrapper,
    recordTokens: (inputTokens: number, outputTokens: number, costUsd?: number) => void
  ) => Promise<T>
): Promise<T> {
  const span = startAgentSpan(options);

  const recordTokens = (inputTokens: number, outputTokens: number, costUsd?: number): void => {
    // Record in OpenTelemetry span
    span.recordTokenUsage(inputTokens, outputTokens, costUsd);

    // Record in MetricsCollector if provided
    if (metricsCollector !== null) {
      metricsCollector.recordTokenUsage(options.agentName, inputTokens, outputTokens);
    }
  };

  try {
    const result = await fn(span, recordTokens);
    if (!span.isEnded()) {
      span.endSuccess();
    }
    return result;
  } catch (error) {
    if (!span.isEnded()) {
      span.endError(error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  }
}
