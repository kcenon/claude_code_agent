# Configuration Directory

This directory contains system-wide configuration files for the AD-SDLC system.

## Files

### agents.yaml
Agent registry defining all available agents and their configurations:
- Agent identifiers and versions
- Model assignments (Sonnet/Opus)
- Tool permissions
- Inter-agent dependencies

### workflow.yaml
Pipeline configuration defining:
- Stage sequence and transitions
- Approval gates
- Retry policies
- Timeout settings
- Worker pool configuration

## Environment-Specific Configuration

The AD-SDLC system supports environment-specific configuration overrides, allowing different settings for development, staging, and production environments.

### How It Works

1. **Base Configuration**: The system loads the base configuration file (e.g., `workflow.yaml`)
2. **Environment Detection**: Detects the current environment from:
   - `AD_SDLC_ENV` environment variable (highest priority)
   - `NODE_ENV` environment variable
3. **Override Loading**: If an environment-specific file exists (e.g., `workflow.development.yaml`), it's loaded and deep-merged with the base configuration

### Configuration File Naming

```
workflow.yaml                  # Base configuration
workflow.development.yaml      # Development overrides
workflow.staging.yaml          # Staging overrides
workflow.production.yaml       # Production overrides
workflow.test.yaml             # Test overrides
workflow.local.yaml            # Local overrides (gitignored)
```

### Merge Behavior

- **Objects**: Deep merged (nested properties are merged recursively)
- **Arrays**: Replaced entirely (not merged)
- **Primitives**: Override values replace base values

### Example

**workflow.yaml** (base):
```yaml
version: "1.0.0"
global:
  log_level: INFO
  project_root: "${PWD}"
agents:
  worker:
    model: sonnet
    max_instances: 5
```

**workflow.development.yaml** (override):
```yaml
global:
  log_level: DEBUG
agents:
  worker:
    max_instances: 2
```

**Merged result** (when `NODE_ENV=development`):
```yaml
version: "1.0.0"
global:
  log_level: DEBUG           # Overridden
  project_root: "${PWD}"     # From base
agents:
  worker:
    model: sonnet            # From base
    max_instances: 2         # Overridden
```

### Disabling Environment Overrides

```typescript
// Load only base configuration
const config = await loadWorkflowConfig({ environment: false });

// Explicitly specify an environment
const config = await loadWorkflowConfig({ environment: 'staging' });
```

## Configuration Validation

The AD-SDLC system provides robust configuration validation using the `ad-sdlc validate` command.

### Validating Configuration

```bash
# Validate all configuration files
ad-sdlc validate

# Validate a specific file
ad-sdlc validate --file .ad-sdlc/config/workflow.yaml

# Watch mode - validate on file changes
ad-sdlc validate --watch

# JSON output for automation
ad-sdlc validate --format json
```

### Validation Features

- **Schema Validation**: Validates structure and types against JSON Schema
- **Clear Error Messages**: Provides actionable error descriptions
- **Watch Mode**: Real-time validation as you edit files
- **JSON Output**: Machine-readable output for CI/CD integration

### VS Code Integration

For autocomplete and validation hints in VS Code:

1. Install the YAML extension (`redhat.vscode-yaml`)
2. Copy the VS Code settings:
   ```bash
   cp -r .vscode.example .vscode
   ```
3. Open any `.yaml` file in the config directory to get schema hints

## Schema Files

JSON Schema files for configuration validation are located at:
- `schemas/workflow.schema.json` - Workflow configuration schema
- `schemas/agents.schema.json` - Agents configuration schema

## Usage

These configuration files are read by the Main Orchestrator at startup. Changes require a system restart to take effect.

## Schema Documentation

Configuration schemas are documented in:
- SDS-001 specification
- JSON Schema files in `/schemas/` directory
