# OpenTelemetry Configuration Examples

This directory contains example configurations for different observability backends.

## Available Configurations

| File | Backend | Use Case |
|------|---------|----------|
| `console-debug.yaml` | Console | Debugging without a backend |
| `jaeger-local.yaml` | Jaeger | Local development |
| `grafana-tempo.yaml` | Grafana Tempo | Local/staging with Grafana |
| `datadog-production.yaml` | Datadog | Production APM |
| `newrelic-production.yaml` | New Relic | Production APM |

## Usage

1. Copy the appropriate configuration to your project:

   ```bash
   cp examples/observability/jaeger-local.yaml .ad-sdlc/config/observability.yaml
   ```

2. Modify any settings as needed (API keys, endpoints, etc.)

3. Start your observability backend (Jaeger, Tempo, etc.)

4. Run the AD-SDLC pipeline - traces will be exported automatically

## Quick Start with Jaeger

```bash
# Start Jaeger
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# Copy configuration
cp examples/observability/jaeger-local.yaml .ad-sdlc/config/observability.yaml

# View traces at http://localhost:16686
```

## Documentation

For detailed setup instructions, see [docs/observability.md](../../docs/observability.md).
