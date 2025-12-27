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
