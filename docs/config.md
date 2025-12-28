# Configuration Module

The configuration module provides centralized access to AD-SDLC workflow and agent configurations with validation, caching, and convenient accessor methods.

## Overview

The module includes:

- **ConfigManager** - Main class for accessing configuration with caching and environment variable substitution
- **Loader** - Functions for loading and parsing YAML configuration files
- **Validation** - Zod-based schema validation for configuration files
- **Watcher** - Configuration file change monitoring

## Installation

The config module is included in the main `ad-sdlc` package:

```typescript
import {
  ConfigManager,
  getConfigManager,
  resetConfigManager,
  loadWorkflowConfig,
  loadAgentsConfig,
  validateWorkflowConfig,
  validateAgentsConfig,
} from 'ad-sdlc';
```

## ConfigManager

Main class that provides centralized access to workflow and agent configurations.

### Basic Usage

```typescript
import { ConfigManager, getConfigManager } from 'ad-sdlc';

// Using singleton (recommended)
const config = await getConfigManager();

// Or create new instance
const config = await ConfigManager.create({
  baseDir: '/path/to/project',
  validate: true,
  resolveEnvVars: true,
});

// Access configuration
const globalConfig = config.getGlobalConfig();
const retryPolicy = config.getRetryPolicy();
const stages = config.getPipelineStages();
const agentConfig = config.getAgentConfig('collector');
const qualityGates = config.getQualityGates();
```

### API Reference

#### ConfigManager.create(options?)

Creates and initializes a ConfigManager instance.

```typescript
const config = await ConfigManager.create({
  baseDir: '/path/to/project',  // Base directory for config files
  validate: true,                // Whether to validate configs (default: true)
  resolveEnvVars: true,          // Resolve ${VAR} patterns (default: true)
});
```

#### getGlobalConfig()

Returns global configuration settings with defaults applied.

```typescript
const global = config.getGlobalConfig();

console.log(global.projectRoot);      // e.g., '/path/to/project'
console.log(global.scratchpadDir);    // e.g., '.ad-sdlc/scratchpad'
console.log(global.logLevel);         // 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
console.log(global.approvalGates);    // Approval gates configuration
console.log(global.retryPolicy);      // Retry policy settings
console.log(global.timeouts);         // Timeout settings
```

#### getRetryPolicy()

Returns retry policy configuration.

```typescript
const retry = config.getRetryPolicy();

console.log(retry.maxAttempts);       // e.g., 3
console.log(retry.backoff);           // 'linear' | 'exponential'
console.log(retry.baseDelaySeconds);  // e.g., 5
console.log(retry.maxDelaySeconds);   // e.g., 60
```

#### getPipelineStages()

Returns ordered array of pipeline stages.

```typescript
const stages = config.getPipelineStages();

for (const stage of stages) {
  console.log(stage.name);            // Stage name
  console.log(stage.agent);           // Agent ID
  console.log(stage.inputs);          // Input file patterns
  console.log(stage.outputs);         // Output file patterns
  console.log(stage.next);            // Next stage name or null
  console.log(stage.approvalRequired); // Whether approval is needed
  console.log(stage.parallel);        // Whether can run in parallel
}
```

#### getPipelineStage(stageName)

Returns a specific pipeline stage by name.

```typescript
const stage = config.getPipelineStage('collection');
if (stage) {
  console.log(`Stage ${stage.name} uses agent ${stage.agent}`);
}
```

#### getAgentConfig(agentId)

Returns workflow configuration for a specific agent.

```typescript
const agentConfig = config.getAgentConfig('collector');

if (agentConfig) {
  console.log(agentConfig.model);       // 'sonnet' | 'opus' | 'haiku'
  console.log(agentConfig.tools);       // ['Read', 'Write', 'Bash', ...]
  console.log(agentConfig.template);    // Template file path
  console.log(agentConfig.maxQuestions); // Max clarification questions
  console.log(agentConfig.github);      // GitHub settings
  console.log(agentConfig.coding);      // Coding settings
  console.log(agentConfig.verification); // Verification settings
}
```

#### getAgentDefinition(agentId)

Returns agent definition from agents.yaml.

```typescript
const definition = config.getAgentDefinition('collector');

if (definition) {
  console.log(definition.id);           // Agent ID
  console.log(definition.name);         // Agent name
  console.log(definition.description);  // Description
  console.log(definition.capabilities); // Capability list
  console.log(definition.io);           // Input/output specs
}
```

#### getQualityGates()

Returns quality gate rules.

```typescript
const gates = config.getQualityGates();

// Document quality gates
if (gates.documentQuality?.prd) {
  console.log(gates.documentQuality.prd.requiredSections);
  console.log(gates.documentQuality.prd.minRequirements);
}

// Code quality gates
if (gates.codeQuality) {
  console.log(gates.codeQuality.coverageThreshold);
  console.log(gates.codeQuality.maxComplexity);
}

// Security gates
if (gates.security) {
  console.log(gates.security.noHardcodedSecrets);
}
```

#### getGitHubConfig()

Returns GitHub integration settings.

```typescript
const github = config.getGitHubConfig();

console.log(github.repo);              // e.g., 'owner/repo'
console.log(github.defaultBranch);     // e.g., 'main'
console.log(github.issueLabels);       // Default issue labels
console.log(github.prLabels);          // Default PR labels
```

#### getLoggingConfig()

Returns logging configuration.

```typescript
const logging = config.getLoggingConfig();

console.log(logging.level);            // Log level
console.log(logging.format);           // 'json' | 'text'
console.log(logging.outputs);          // Output configurations
```

### Singleton Management

```typescript
import {
  getConfigManager,
  resetConfigManager,
  isConfigManagerInitialized,
} from 'ad-sdlc';

// Get or create singleton instance
const config = await getConfigManager();

// Check if initialized
if (isConfigManagerInitialized()) {
  console.log('ConfigManager is ready');
}

// Reset singleton (useful for testing)
resetConfigManager();
```

## Environment Variable Substitution

ConfigManager automatically resolves environment variables in configuration values:

```yaml
# workflow.yaml
global:
  project_root: ${PWD}
  output_docs_dir: ${DOCS_DIR:-docs}
```

```typescript
import { resolveEnvVars } from 'ad-sdlc';

// Manual resolution
const resolved = resolveEnvVars('${HOME}/projects');
```

## Configuration Files

### workflow.yaml

Main workflow configuration file located at `.ad-sdlc/config/workflow.yaml`:

```yaml
version: "1.0.0"
name: "my-project"

global:
  project_root: ${PWD}
  scratchpad_dir: .ad-sdlc/scratchpad
  log_level: INFO
  approval_gates:
    after_collection: true
    after_prd: true
  retry_policy:
    max_attempts: 3
    backoff: exponential
    base_delay_seconds: 5

pipeline:
  stages:
    - name: collection
      agent: collector
      outputs: [collected_info.yaml]
      next: prd_generation

agents:
  collector:
    model: sonnet
    tools: [Read, Write, Bash]
```

### agents.yaml

Agent definitions file located at `.ad-sdlc/config/agents.yaml`:

```yaml
version: "1.0.0"

agents:
  collector:
    id: collector
    name: Collector Agent
    description: Collects requirements from various sources
    capabilities:
      - requirement_collection
      - file_parsing
      - url_parsing
```

## Low-Level Loading

For direct file loading without ConfigManager:

```typescript
import {
  loadWorkflowConfig,
  loadAgentsConfig,
  loadAllConfigs,
} from 'ad-sdlc';

// Load individual configs
const workflow = await loadWorkflowConfig({ baseDir: '/path/to/project' });
const agents = await loadAgentsConfig({ baseDir: '/path/to/project' });

// Load both at once
const { workflow, agents } = await loadAllConfigs();
```

## Validation

For validating configuration data:

```typescript
import {
  validateWorkflowConfig,
  validateAgentsConfig,
  ConfigValidationError,
} from 'ad-sdlc';

const result = validateWorkflowConfig(data);

if (result.success) {
  console.log('Config is valid');
  console.log(result.data);
} else {
  console.log('Validation errors:');
  for (const error of result.errors) {
    console.log(`  ${error.path}: ${error.message}`);
  }
}
```

## Configuration Watching

Monitor configuration files for changes:

```typescript
import { watchConfigFiles, ConfigWatcher } from 'ad-sdlc';

// Simple watching
const cleanup = await watchConfigFiles((filePath, result) => {
  if (result.valid) {
    console.log(`${filePath} updated and valid`);
  } else {
    console.log(`${filePath} has errors:`, result.errors);
  }
});

// Stop watching
cleanup();

// Or use ConfigWatcher class for more control
const watcher = new ConfigWatcher({
  debounceMs: 500,
  validateOnChange: true,
});

watcher.on('change', (filePath, result) => {
  // Handle change
});

await watcher.start();
```

## Error Handling

```typescript
import {
  ConfigNotFoundError,
  ConfigParseError,
  ConfigValidationError,
} from 'ad-sdlc';

try {
  const config = await getConfigManager();
} catch (error) {
  if (error instanceof ConfigNotFoundError) {
    console.log('Config file not found:', error.filePath);
  } else if (error instanceof ConfigParseError) {
    console.log('YAML parse error:', error.message);
  } else if (error instanceof ConfigValidationError) {
    console.log('Validation errors:', error.errors);
  }
}
```

## Type Exports

All configuration types are exported for TypeScript usage:

```typescript
import type {
  WorkflowConfig,
  AgentsConfig,
  GlobalConfig,
  RetryPolicy,
  PipelineStage,
  AgentWorkflowConfig,
  QualityGates,
  ValidationResult,
  FieldError,
} from 'ad-sdlc';
```
