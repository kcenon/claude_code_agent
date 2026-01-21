# OpenTelemetry Observability Guide

This guide explains how to set up and configure OpenTelemetry integration for distributed tracing in the AD-SDLC pipeline.

## Overview

The AD-SDLC monitoring module provides OpenTelemetry integration for:

- **Distributed Tracing** - Track request flow across agents and subagents
- **Span Hierarchies** - Visualize parent-child relationships between operations
- **Token Usage Tracking** - Monitor LLM token consumption per span
- **Multiple Exporters** - Send traces to Jaeger, Grafana Tempo, Datadog, and more

## Quick Start

### 1. Create Configuration File

Create `.ad-sdlc/config/observability.yaml`:

```yaml
opentelemetry:
  enabled: true
  serviceName: ad-sdlc-pipeline
  exporters:
    - type: console
      enabled: true
  sampling:
    type: always_on
```

### 2. Initialize OpenTelemetry

```typescript
import { initializeOpenTelemetry } from 'ad-sdlc';

// Initialize at application startup
await initializeOpenTelemetry();
```

### 3. View Traces

With console exporter enabled, traces are printed to stdout in JSON format.

## Configuration Reference

### Full Configuration Schema

```yaml
opentelemetry:
  # Enable/disable OpenTelemetry integration
  enabled: true

  # Service name for traces
  serviceName: ad-sdlc-pipeline

  # Exporter configurations (multiple supported)
  exporters:
    - type: console
      enabled: true

    - type: otlp
      enabled: true
      endpoint: http://localhost:4318/v1/traces
      headers:
        Authorization: Bearer <token>
      timeoutMs: 30000

    - type: jaeger
      enabled: false
      endpoint: http://localhost:14268/api/traces

  # Sampling configuration
  sampling:
    # Options: always_on, always_off, probability, rate_limiting
    type: probability
    # For probability sampling (0.0-1.0)
    probability: 0.5
    # For rate_limiting sampling (spans per second)
    rateLimit: 100

  # Resource attributes for trace metadata
  resourceAttributes:
    environment: development
    serviceVersion: 1.0.0
    custom:
      team: platform
      region: us-west-2
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable/disable OpenTelemetry |
| `serviceName` | `string` | `ad-sdlc-pipeline` | Service name in traces |
| `exporters` | `array` | `[{type: 'console', enabled: false}]` | Exporter configurations |
| `sampling.type` | `string` | `always_on` | Sampling strategy |
| `sampling.probability` | `number` | `1.0` | Probability for sampling (0.0-1.0) |
| `sampling.rateLimit` | `number` | - | Max spans per second |
| `resourceAttributes` | `object` | - | Custom resource attributes |

### Exporter Types

| Type | Description | Required Options |
|------|-------------|------------------|
| `console` | Prints traces to stdout | - |
| `otlp` | OpenTelemetry Protocol (HTTP) | `endpoint` |
| `jaeger` | Jaeger collector endpoint | `endpoint` |

## Platform Setup Guides

### Jaeger (Local Development)

Jaeger provides an all-in-one Docker image for local development.

#### 1. Start Jaeger

```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  -p 14268:14268 \
  jaegertracing/all-in-one:latest
```

#### 2. Configure AD-SDLC

```yaml
# .ad-sdlc/config/observability.yaml
opentelemetry:
  enabled: true
  serviceName: ad-sdlc-pipeline
  exporters:
    - type: otlp
      enabled: true
      endpoint: http://localhost:4318/v1/traces
  sampling:
    type: always_on
  resourceAttributes:
    environment: development
```

#### 3. View Traces

Open [http://localhost:16686](http://localhost:16686) in your browser to access the Jaeger UI.

### Grafana Tempo

Grafana Tempo is a distributed tracing backend that integrates with Grafana.

#### 1. Start Tempo with Docker Compose

Create `docker-compose.yaml`:

```yaml
version: '3.8'
services:
  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "3200:3200"   # Tempo query

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - ./grafana-datasources.yaml:/etc/grafana/provisioning/datasources/datasources.yaml
```

Create `tempo.yaml`:

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
        grpc:

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/traces
```

Create `grafana-datasources.yaml`:

```yaml
apiVersion: 1
datasources:
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    isDefault: true
```

#### 2. Start Services

```bash
docker-compose up -d
```

#### 3. Configure AD-SDLC

```yaml
# .ad-sdlc/config/observability.yaml
opentelemetry:
  enabled: true
  serviceName: ad-sdlc-pipeline
  exporters:
    - type: otlp
      enabled: true
      endpoint: http://localhost:4318/v1/traces
  sampling:
    type: always_on
  resourceAttributes:
    environment: development
```

#### 4. View Traces

1. Open Grafana at [http://localhost:3000](http://localhost:3000)
2. Navigate to Explore > Select "Tempo" datasource
3. Search for traces by service name or trace ID

### Datadog

Datadog provides APM with distributed tracing capabilities.

#### 1. Install Datadog Agent

Follow the [Datadog Agent installation guide](https://docs.datadoghq.com/agent/) for your platform.

#### 2. Enable OTLP Ingestion

Add to your Datadog Agent configuration (`datadog.yaml`):

```yaml
otlp_config:
  receiver:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
```

#### 3. Configure AD-SDLC

```yaml
# .ad-sdlc/config/observability.yaml
opentelemetry:
  enabled: true
  serviceName: ad-sdlc-pipeline
  exporters:
    - type: otlp
      enabled: true
      endpoint: http://localhost:4318/v1/traces
      headers:
        DD-API-KEY: <your-api-key>
  sampling:
    type: probability
    probability: 0.1  # Sample 10% in production
  resourceAttributes:
    environment: production
    serviceVersion: ${npm_package_version}
```

#### 4. View Traces

Navigate to APM > Traces in the Datadog UI.

### New Relic

New Relic supports OTLP natively.

#### 1. Configure AD-SDLC

```yaml
# .ad-sdlc/config/observability.yaml
opentelemetry:
  enabled: true
  serviceName: ad-sdlc-pipeline
  exporters:
    - type: otlp
      enabled: true
      endpoint: https://otlp.nr-data.net:4318/v1/traces
      headers:
        api-key: <your-license-key>
  sampling:
    type: probability
    probability: 0.1
  resourceAttributes:
    environment: production
```

## Programmatic Usage

### Basic Tracing

```typescript
import {
  getOpenTelemetryProvider,
  initializeOpenTelemetry
} from 'ad-sdlc';

// Initialize at startup
await initializeOpenTelemetry();

// Get provider instance
const provider = getOpenTelemetryProvider();

// Start a span
const span = provider.startSpan('my-operation');

try {
  // Perform operation
  await doWork();
  provider.endSpanSuccess(span);
} catch (error) {
  provider.endSpanError(span, error instanceof Error ? error : new Error(String(error)));
  throw error;
}
```

### Agent Span Instrumentation

```typescript
import { startAgentSpan, withAgentSpan } from 'ad-sdlc';

// Manual span management
const span = startAgentSpan({
  agentName: 'worker',
  agentType: 'processor',
  correlationId: 'uuid-123',
  pipelineStage: 'implementation',
  pipelineMode: 'greenfield'
});

try {
  const result = await processWork();
  span.recordTokenUsage(1000, 500, 0.05);
  span.endSuccess();
  return result;
} catch (error) {
  span.endError(error instanceof Error ? error : new Error(String(error)));
  throw error;
}

// Or use the helper function
const result = await withAgentSpan(
  {
    agentName: 'collector',
    agentType: 'analyzer',
    correlationId: 'uuid-123'
  },
  async (span) => {
    span.addEvent('processing_started');
    const data = await processData();
    span.recordTokenUsage(data.inputTokens, data.outputTokens);
    return data.result;
  }
);
```

### Tool Span Instrumentation

```typescript
import { startToolSpan, withToolSpan, recordToolResult } from 'ad-sdlc';

// Manual span management
const toolSpan = startToolSpan({
  toolName: 'Read',
  parentContext: agentSpan.getContext()
});

try {
  const content = await readFile(path);
  recordToolResult(toolSpan, { success: true, result: 'file read' });
  return content;
} catch (error) {
  recordToolResult(toolSpan, {
    success: false,
    error: error instanceof Error ? error : new Error(String(error))
  });
  throw error;
}

// Or use the helper function
const content = await withToolSpan(
  { toolName: 'Read', parentContext: agentSpan.getContext() },
  async (span) => {
    span.addEvent('reading_file', { path: filePath });
    return await readFile(filePath);
  }
);
```

### LLM Span Instrumentation

```typescript
import { startLLMSpan, withLLMSpan } from 'ad-sdlc';

// Manual span management
const llmSpan = startLLMSpan({
  modelName: 'claude-3-sonnet',
  parentContext: agentSpan.getContext()
});

try {
  const response = await callLLMAPI(prompt);
  llmSpan.recordTokenUsage(
    response.inputTokens,
    response.outputTokens,
    response.cost
  );
  llmSpan.endSuccess();
  return response;
} catch (error) {
  llmSpan.endError(error instanceof Error ? error : new Error(String(error)));
  throw error;
}

// Or use the helper function
const response = await withLLMSpan(
  { modelName: 'claude-3-sonnet', parentContext: agentSpan.getContext() },
  async (span) => {
    span.addEvent('llm_request_sent');
    const apiResponse = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: prompt }]
    });
    return {
      result: apiResponse.content,
      inputTokens: apiResponse.usage.input_tokens,
      outputTokens: apiResponse.usage.output_tokens,
      costUsd: calculateCost(apiResponse.usage)
    };
  }
);
```

### Subagent Context Propagation

```typescript
import { propagateToSubagent, startAgentSpan } from 'ad-sdlc';

// Parent agent
const parentSpan = startAgentSpan({
  agentName: 'orchestrator',
  agentType: 'coordinator'
});

// Propagate context to subagent
const subagentContext = propagateToSubagent(parentSpan, 'tool-use-123');

// Child agent uses parent context
const childSpan = startAgentSpan({
  agentName: 'worker',
  agentType: 'processor',
  parentToolUseId: 'tool-use-123',
  parentContext: subagentContext
});
```

### Unified Tracing with MetricsCollector

```typescript
import { withTracedAgent, getMetricsCollector } from 'ad-sdlc';

const result = await withTracedAgent(
  {
    agentName: 'worker',
    agentType: 'processor',
    pipelineStage: 'implementation',
    pipelineMode: 'greenfield'
  },
  getMetricsCollector(),
  async (span, recordTokens) => {
    const response = await processWithLLM();
    // Records to both OpenTelemetry span and MetricsCollector
    recordTokens(response.inputTokens, response.outputTokens, response.cost);
    return response.result;
  }
);
```

## Span Hierarchy

AD-SDLC creates a hierarchical span structure for pipeline execution:

```
pipeline_execution (root)
├── agent:orchestrator
│   ├── agent:collector
│   │   ├── tool:WebFetch
│   │   ├── tool:Read
│   │   └── llm:claude-sonnet
│   ├── agent:prd-writer
│   │   ├── tool:Read
│   │   ├── tool:Write
│   │   └── llm:claude-opus
│   └── agent:srs-writer
│       ├── tool:Read
│       ├── tool:Write
│       └── llm:claude-opus
└── ...
```

## Span Attributes

AD-SDLC adds custom attributes to spans for pipeline-specific context:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `adsdlc.agent.name` | Agent name | `worker` |
| `adsdlc.agent.type` | Agent type | `processor` |
| `adsdlc.pipeline.stage` | Pipeline stage | `implementation` |
| `adsdlc.pipeline.mode` | Pipeline mode | `greenfield` |
| `adsdlc.tool.name` | Tool name | `Read` |
| `adsdlc.tool.result` | Tool result status | `success` |
| `adsdlc.tokens.input` | Input tokens used | `1000` |
| `adsdlc.tokens.output` | Output tokens generated | `500` |
| `adsdlc.tokens.cost` | Cost in USD | `0.05` |
| `adsdlc.model.name` | LLM model name | `claude-3-sonnet` |
| `adsdlc.correlation_id` | Correlation ID | `uuid-123` |
| `adsdlc.parent_tool_use_id` | Parent tool use ID | `tool-use-456` |

## Sampling Strategies

Choose the right sampling strategy based on your needs:

| Strategy | Use Case | Configuration |
|----------|----------|---------------|
| `always_on` | Development/debugging | `type: always_on` |
| `always_off` | Disable tracing | `type: always_off` |
| `probability` | Production with sampling | `type: probability`, `probability: 0.1` |
| `rate_limiting` | High-volume production | `type: rate_limiting`, `rateLimit: 100` |

## Troubleshooting

### Traces Not Appearing

1. **Check configuration file location**: Ensure `observability.yaml` is in `.ad-sdlc/config/`

2. **Verify enabled flag**: `enabled: true` must be set

3. **Check exporter connectivity**:
   ```bash
   curl -v http://localhost:4318/v1/traces
   ```

4. **Enable console exporter for debugging**:
   ```yaml
   exporters:
     - type: console
       enabled: true
   ```

### Missing Spans

1. **Ensure proper span ending**: Always call `endSuccess()` or `endError()`

2. **Check sampling configuration**: Set `type: always_on` for debugging

3. **Verify parent context propagation**: Use `parentContext` parameter

### High Memory Usage

1. **Reduce sampling rate**: Use probability or rate_limiting sampling

2. **Check exporter buffer**: OTLP uses batch processing; reduce batch size if needed

### Connection Errors

1. **Verify endpoint URL**: Check protocol (http/https) and port

2. **Check firewall rules**: Ensure outbound connections are allowed

3. **Verify authentication**: Check API keys and headers

## Best Practices

1. **Use meaningful span names**: Include operation type and identifier
   ```typescript
   startSpan('agent:worker:process-issue-123')
   ```

2. **Add relevant attributes**: Include context that helps with debugging
   ```typescript
   span.setAttribute('issue.number', 123);
   span.setAttribute('issue.priority', 'high');
   ```

3. **Record errors properly**: Use `recordException` for full stack traces
   ```typescript
   span.recordException(error);
   span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
   ```

4. **Use appropriate sampling in production**: Start with 10% and adjust based on volume

5. **Propagate context across boundaries**: Always pass parent context to child spans

6. **Clean shutdown**: Call `shutdown()` to flush pending spans
   ```typescript
   const provider = getOpenTelemetryProvider();
   await provider.shutdown();
   ```

## API Reference

For detailed API documentation, see:

- [OpenTelemetryProvider API](./api/monitoring/OpenTelemetryProvider.md)
- [Tracing Utilities API](./api/monitoring/tracing.md)
- [Monitoring Types](./api/monitoring/types.md)
