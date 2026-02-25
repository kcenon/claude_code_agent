/**
 * OpenTelemetryProvider - Centralized OpenTelemetry SDK management
 *
 * Provides trace initialization, configuration, and lifecycle management
 * for distributed tracing across the AD-SDLC pipeline.
 *
 * Features:
 * - Singleton pattern for global access
 * - Multiple exporter support (Console, OTLP, Jaeger)
 * - Configuration from YAML files
 * - Graceful shutdown handling
 * - Custom AD-SDLC span attributes
 */

import type { Resource } from '@opentelemetry/resources';
import type { SpanProcessor, SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { Tracer, Span, SpanOptions, Context } from '@opentelemetry/api';

const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

/**
 * Dynamically load heavy @opentelemetry/* SDK packages (~37MB total).
 * Avoids eagerly importing these modules at CLI startup.
 * The lightweight @opentelemetry/api is cached on first use via initialize().
 */
const getOTelApi = async (): Promise<typeof import('@opentelemetry/api')> =>
  import('@opentelemetry/api');
const getOTelSdkNode = async (): Promise<typeof import('@opentelemetry/sdk-node')> =>
  import('@opentelemetry/sdk-node');
const getOTelResources = async (): Promise<typeof import('@opentelemetry/resources')> =>
  import('@opentelemetry/resources');
const getOTelSemanticConventions = async (): Promise<
  typeof import('@opentelemetry/semantic-conventions')
> => import('@opentelemetry/semantic-conventions');
const getOTelSdkTraceBase = async (): Promise<typeof import('@opentelemetry/sdk-trace-base')> =>
  import('@opentelemetry/sdk-trace-base');
const getOTelExporterOtlp = async (): Promise<
  typeof import('@opentelemetry/exporter-trace-otlp-http')
> => import('@opentelemetry/exporter-trace-otlp-http');
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

import type {
  OpenTelemetryConfig,
  OpenTelemetryExporterConfig,
  OpenTelemetrySamplingConfig,
  SpanContext,
} from './types.js';
import { ADSDLC_SPAN_ATTRIBUTES } from './types.js';

/**
 * Default configuration directory
 */
import { DEFAULT_PATHS } from '../config/paths.js';
const DEFAULT_CONFIG_DIR = DEFAULT_PATHS.CONFIG_SUBDIR;

/**
 * Default observability configuration file name
 */
const OBSERVABILITY_CONFIG_FILE = 'observability.yaml';

/**
 * Default OpenTelemetry configuration
 */
const DEFAULT_CONFIG: OpenTelemetryConfig = {
  enabled: false,
  serviceName: 'ad-sdlc-pipeline',
  exporters: [{ type: 'console', enabled: false }],
  sampling: { type: 'always_on' },
  resourceAttributes: {
    environment: 'development',
  },
};

/**
 * OpenTelemetry provider for distributed tracing
 */
export class OpenTelemetryProvider {
  private sdk: InstanceType<(typeof import('@opentelemetry/sdk-node'))['NodeSDK']> | null = null;
  private tracer: Tracer | null = null;
  private config: OpenTelemetryConfig;
  private initialized = false;
  private shutdownPromise: Promise<void> | null = null;

  /**
   * Cached references to @opentelemetry/api values, populated during initialize().
   * Keeps runtime methods synchronous after one-time async loading.
   */
  private otelTrace: (typeof import('@opentelemetry/api'))['trace'] | null = null;
  private otelContext: (typeof import('@opentelemetry/api'))['context'] | null = null;
  private otelSpanStatusCode: (typeof import('@opentelemetry/api'))['SpanStatusCode'] | null = null;

  constructor(config?: Partial<OpenTelemetryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the OpenTelemetry SDK
   *
   * @param configPath - Optional path to configuration file
   * @returns Promise resolving when initialization is complete
   */
  public async initialize(configPath?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load configuration from file if not provided in constructor
    if (configPath !== undefined || this.config === DEFAULT_CONFIG) {
      await this.loadConfig(configPath);
    }

    if (!this.config.enabled) {
      this.initialized = true;
      return;
    }

    // Create resource with service information
    const resource = await this.createResource();

    // Create span processors for each enabled exporter
    const spanProcessors = await this.createSpanProcessors();

    if (spanProcessors.length === 0) {
      // No exporters enabled, just mark as initialized
      this.initialized = true;
      return;
    }

    // Initialize the SDK
    const { NodeSDK } = await getOTelSdkNode();
    this.sdk = new NodeSDK({
      resource,
      spanProcessors,
    });

    try {
      this.sdk.start();
      const otelApi = await getOTelApi();
      this.otelTrace = otelApi.trace;
      this.otelContext = otelApi.context;
      this.otelSpanStatusCode = otelApi.SpanStatusCode;
      this.tracer = this.otelTrace.getTracer(this.config.serviceName, '1.0.0');
      this.initialized = true;

      // Register shutdown handlers
      this.registerShutdownHandlers();
    } catch (error) {
      throw new Error(
        `Failed to initialize OpenTelemetry SDK: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  /**
   * Load configuration from YAML file
   *
   * @param configPath - Optional path to configuration file (defaults to observability.yaml in config directory)
   */
  private async loadConfig(configPath?: string): Promise<void> {
    const path =
      configPath ?? resolve(process.cwd(), DEFAULT_CONFIG_DIR, OBSERVABILITY_CONFIG_FILE);

    if (!existsSync(path)) {
      // Use default configuration if file doesn't exist
      return;
    }

    try {
      const content = await readFile(path, 'utf-8');
      const parsed = yaml.load(content) as { opentelemetry?: Partial<OpenTelemetryConfig> } | null;

      if (parsed !== null && parsed.opentelemetry !== undefined) {
        const parsedSampling = parsed.opentelemetry.sampling;
        const sampling: OpenTelemetrySamplingConfig = {
          type: parsedSampling?.type ?? DEFAULT_CONFIG.sampling?.type ?? 'always_on',
        };
        const probability = parsedSampling?.probability ?? DEFAULT_CONFIG.sampling?.probability;
        if (probability !== undefined) {
          (sampling as { probability?: number }).probability = probability;
        }
        const rateLimit = parsedSampling?.rateLimit ?? DEFAULT_CONFIG.sampling?.rateLimit;
        if (rateLimit !== undefined) {
          (sampling as { rateLimit?: number }).rateLimit = rateLimit;
        }
        this.config = {
          ...DEFAULT_CONFIG,
          ...parsed.opentelemetry,
          exporters: parsed.opentelemetry.exporters ?? DEFAULT_CONFIG.exporters,
          sampling,
          resourceAttributes: {
            ...DEFAULT_CONFIG.resourceAttributes,
            ...parsed.opentelemetry.resourceAttributes,
          },
        };
      }
    } catch (error) {
      throw new Error(
        `Failed to load OpenTelemetry configuration: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  /**
   * Create OpenTelemetry resource with service attributes
   * @returns OpenTelemetry resource with service name, version, and custom attributes
   */
  private async createResource(): Promise<Resource> {
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await getOTelSemanticConventions();
    const { resourceFromAttributes } = await getOTelResources();

    const attributes: Record<string, string> = {
      [ATTR_SERVICE_NAME]: this.config.serviceName,
    };

    if (this.config.resourceAttributes?.serviceVersion !== undefined) {
      attributes[ATTR_SERVICE_VERSION] = this.config.resourceAttributes.serviceVersion;
    }

    if (this.config.resourceAttributes?.environment !== undefined) {
      attributes[ATTR_DEPLOYMENT_ENVIRONMENT] = this.config.resourceAttributes.environment;
    }

    // Add custom attributes
    if (this.config.resourceAttributes?.custom !== undefined) {
      for (const [key, value] of Object.entries(this.config.resourceAttributes.custom)) {
        attributes[key] = value;
      }
    }

    return resourceFromAttributes(attributes);
  }

  /**
   * Create span processors for configured exporters
   * @returns Array of span processors for each enabled exporter
   */
  private async createSpanProcessors(): Promise<SpanProcessor[]> {
    const processors: SpanProcessor[] = [];
    const traceBase = await getOTelSdkTraceBase();

    for (const exporterConfig of this.config.exporters) {
      if (exporterConfig.enabled === false) {
        continue;
      }

      const exporter = await this.createExporter(exporterConfig);
      if (exporter !== null) {
        // Use SimpleSpanProcessor for console (for immediate output)
        // Use BatchSpanProcessor for network exporters (for efficiency)
        const processor =
          exporterConfig.type === 'console'
            ? new traceBase.SimpleSpanProcessor(exporter)
            : new traceBase.BatchSpanProcessor(exporter);
        processors.push(processor);
      }
    }

    return processors;
  }

  /**
   * Create a span exporter based on configuration
   * @param config - Exporter configuration specifying type, endpoint, and connection options
   * @returns Configured span exporter instance, or null if configuration is invalid
   */
  private async createExporter(config: OpenTelemetryExporterConfig): Promise<SpanExporter | null> {
    switch (config.type) {
      case 'console': {
        const { ConsoleSpanExporter } = await getOTelSdkTraceBase();
        return new ConsoleSpanExporter();
      }

      case 'otlp':
      case 'jaeger': {
        if (config.endpoint === undefined) {
          return null;
        }
        const exporterOptions: {
          url: string;
          headers?: Record<string, string>;
          timeoutMillis?: number;
        } = {
          url: config.endpoint,
        };
        if (config.headers !== undefined) {
          exporterOptions.headers = config.headers;
        }
        if (config.timeoutMs !== undefined) {
          exporterOptions.timeoutMillis = config.timeoutMs;
        }
        const { OTLPTraceExporter } = await getOTelExporterOtlp();
        return new OTLPTraceExporter(exporterOptions);
      }

      default:
        return null;
    }
  }

  /**
   * Register process shutdown handlers for graceful cleanup
   */
  private registerShutdownHandlers(): void {
    const shutdown = (): void => {
      void this.shutdown();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Gracefully shutdown the OpenTelemetry SDK
   *
   * @returns Promise resolving when shutdown is complete
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized || this.sdk === null) {
      return;
    }

    // Return existing shutdown promise if already shutting down
    if (this.shutdownPromise !== null) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = (async (): Promise<void> => {
      try {
        await this.sdk?.shutdown();
      } finally {
        this.sdk = null;
        this.tracer = null;
        this.initialized = false;
        this.shutdownPromise = null;
      }
    })();

    return this.shutdownPromise;
  }

  /**
   * Check if the provider is initialized and enabled
   * @returns True if OpenTelemetry is initialized and enabled, false otherwise
   */
  public isEnabled(): boolean {
    return this.initialized && this.config.enabled;
  }

  /**
   * Get the current configuration
   * @returns The current OpenTelemetry configuration (read-only)
   */
  public getConfig(): Readonly<OpenTelemetryConfig> {
    return this.config;
  }

  /**
   * Get the tracer instance
   *
   * @returns Tracer or null if not initialized/enabled
   */
  public getTracer(): Tracer | null {
    return this.tracer;
  }

  /**
   * Start a new span
   *
   * @param name - Span name
   * @param options - Span options
   * @param parentContext - Optional parent context
   * @returns Started span or null if not enabled
   */
  public startSpan(name: string, options?: SpanOptions, parentContext?: Context): Span | null {
    if (!this.isEnabled() || this.tracer === null || this.otelContext === null) {
      return null;
    }

    const ctx = parentContext ?? this.otelContext.active();
    return this.tracer.startSpan(name, options, ctx);
  }

  /**
   * Start a span for an agent execution
   *
   * @param agentName - Name of the agent
   * @param agentType - Type of the agent
   * @param correlationId - Correlation ID for tracing
   * @returns Started span or null if not enabled
   */
  public startAgentSpan(agentName: string, agentType: string, correlationId?: string): Span | null {
    const span = this.startSpan(`agent:${agentName}`, {
      attributes: {
        [ADSDLC_SPAN_ATTRIBUTES.AGENT_NAME]: agentName,
        [ADSDLC_SPAN_ATTRIBUTES.AGENT_TYPE]: agentType,
      },
    });

    if (span !== null && correlationId !== undefined) {
      span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.CORRELATION_ID, correlationId);
    }

    return span;
  }

  /**
   * Start a span for a tool invocation
   *
   * @param toolName - Name of the tool
   * @param parentContext - Optional parent context
   * @returns Started span or null if not enabled
   */
  public startToolSpan(toolName: string, parentContext?: Context): Span | null {
    return this.startSpan(
      `tool:${toolName}`,
      {
        attributes: {
          [ADSDLC_SPAN_ATTRIBUTES.TOOL_NAME]: toolName,
        },
      },
      parentContext
    );
  }

  /**
   * Start a span for an LLM API call
   *
   * @param modelName - Name of the model
   * @param parentContext - Optional parent context
   * @returns Started span or null if not enabled
   */
  public startLLMSpan(modelName: string, parentContext?: Context): Span | null {
    return this.startSpan(
      `llm:${modelName}`,
      {
        attributes: {
          [ADSDLC_SPAN_ATTRIBUTES.MODEL_NAME]: modelName,
        },
      },
      parentContext
    );
  }

  /**
   * End a span with success status
   *
   * @param span - Span to end
   * @param attributes - Optional additional attributes
   */
  public endSpanSuccess(span: Span | null, attributes?: Record<string, string | number>): void {
    if (span === null) {
      return;
    }

    if (attributes !== undefined) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }

    if (this.otelSpanStatusCode !== null) {
      span.setStatus({ code: this.otelSpanStatusCode.OK });
    }
    span.end();
  }

  /**
   * End a span with error status
   *
   * @param span - Span to end
   * @param error - Error that occurred
   */
  public endSpanError(span: Span | null, error: Error): void {
    if (span === null) {
      return;
    }

    if (this.otelSpanStatusCode !== null) {
      span.setStatus({
        code: this.otelSpanStatusCode.ERROR,
        message: error.message,
      });
    }
    span.recordException(error);
    span.end();
  }

  /**
   * Record token usage on a span
   *
   * @param span - Span to record on
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @param costUsd - Cost in USD
   */
  public recordTokenUsage(
    span: Span | null,
    inputTokens: number,
    outputTokens: number,
    costUsd?: number
  ): void {
    if (span === null) {
      return;
    }

    span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOKENS_INPUT, inputTokens);
    span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOKENS_OUTPUT, outputTokens);
    if (costUsd !== undefined) {
      span.setAttribute(ADSDLC_SPAN_ATTRIBUTES.TOKENS_COST, costUsd);
    }
  }

  /**
   * Get the current span context for propagation
   *
   * @returns Span context or null if not available
   */
  public getCurrentSpanContext(): SpanContext | null {
    if (!this.isEnabled()) {
      return null;
    }

    if (this.otelTrace === null) {
      return null;
    }
    const span = this.otelTrace.getActiveSpan();
    if (span === undefined) {
      return null;
    }

    const ctx = span.spanContext();
    return {
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      traceFlags: ctx.traceFlags,
    };
  }

  /**
   * Execute a function within a span context
   *
   * @param name - Span name
   * @param fn - Function to execute
   * @param options - Optional span options
   * @returns Result of the function
   */
  public async withSpan<T>(
    name: string,
    fn: (span: Span | null) => Promise<T>,
    options?: SpanOptions
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      const result = await fn(span);
      this.endSpanSuccess(span);
      return result;
    } catch (error) {
      this.endSpanError(span, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Reset the provider (for testing)
   */
  public async reset(): Promise<void> {
    await this.shutdown();
    this.config = { ...DEFAULT_CONFIG };
    this.otelTrace = null;
    this.otelContext = null;
    this.otelSpanStatusCode = null;
  }
}

/**
 * Singleton instance for global access
 */
let globalProvider: OpenTelemetryProvider | null = null;

/**
 * Get or create the global OpenTelemetryProvider instance
 *
 * @param config - Optional configuration
 * @returns OpenTelemetryProvider instance
 */
export function getOpenTelemetryProvider(
  config?: Partial<OpenTelemetryConfig>
): OpenTelemetryProvider {
  if (globalProvider === null) {
    globalProvider = new OpenTelemetryProvider(config);
  }
  return globalProvider;
}

/**
 * Reset the global OpenTelemetryProvider instance (for testing)
 */
export async function resetOpenTelemetryProvider(): Promise<void> {
  if (globalProvider !== null) {
    await globalProvider.shutdown();
    globalProvider = null;
  }
}

/**
 * Initialize the global OpenTelemetryProvider
 *
 * @param configPath - Optional path to configuration file
 * @returns Promise resolving when initialization is complete
 */
export async function initializeOpenTelemetry(configPath?: string): Promise<void> {
  const provider = getOpenTelemetryProvider();
  await provider.initialize(configPath);
}
