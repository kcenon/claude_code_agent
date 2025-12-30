# Agent Customization and Extension Guide

## Overview

This guide explains how to customize existing agents and create new agents for the AD-SDLC system. The agent-based architecture allows you to extend and modify the system to match your specific development workflow and organizational requirements.

## Table of Contents

- [Agent Definition Format](#agent-definition-format)
- [Customizing Existing Agents](#customizing-existing-agents)
- [Creating New Agents](#creating-new-agents)
- [Integrating with Workflow](#integrating-with-workflow)
- [Best Practices](#best-practices)
- [Testing Custom Agents](#testing-custom-agents)
- [Troubleshooting](#troubleshooting)

## Agent Definition Format

Agents in AD-SDLC are defined using two complementary configurations:

### 1. Agent Registry (agents.yaml)

The central agent registry at `.ad-sdlc/config/agents.yaml` contains metadata for all agents:

```yaml
agents:
  my-agent:
    id: "my-agent"
    name: "My Agent"
    korean_name: "내 에이전트"
    description: "Brief description of what this agent does"
    definition_file: ".claude/agents/my-agent.md"
    category: "document_pipeline"
    order: 5

    capabilities:
      - "capability_one"
      - "capability_two"
      - "capability_three"

    io:
      inputs:
        - input_file.yaml
        - user_message
      outputs:
        - output_file.yaml
        - generated_files/*

    parallelizable: false
    max_instances: 1

    metrics:
      avg_duration_seconds: 120
      success_rate: 0.95
```

#### Key Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (kebab-case) |
| `name` | string | Yes | Display name |
| `description` | string | Yes | What the agent does |
| `definition_file` | string | Yes | Path to Markdown definition |
| `category` | string | Yes | Agent category for grouping |
| `order` | number | Yes | Execution order within category |
| `capabilities` | array | Yes | List of agent capabilities |
| `io.inputs` | array | Yes | Expected input files/types |
| `io.outputs` | array | Yes | Generated output files |
| `parallelizable` | boolean | No | Can run in parallel (default: false) |
| `max_instances` | number | No | Max parallel instances |
| `metrics` | object | No | Performance metrics |

### 2. Agent Definition File (Markdown)

The actual agent behavior is defined in a Markdown file (referenced by `definition_file`):

```markdown
# My Agent

## Role

Describe the agent's primary role and purpose in the pipeline.

## Responsibilities

1. First responsibility
2. Second responsibility
3. Third responsibility

## Workflow

### Input Processing
1. Receive input from previous stage
2. Validate input format

### Core Processing
1. Perform main task
2. Generate intermediate results

### Output Generation
1. Format output
2. Write to scratchpad

## Input/Output

### Inputs
- `input_file.yaml`: Description of input format
- `user_message`: User-provided context

### Outputs
- `output_file.yaml`: Description of output format

## File Locations

- Input: `.ad-sdlc/scratchpad/input/`
- Output: `.ad-sdlc/scratchpad/output/`

## Quality Criteria

- Criterion 1
- Criterion 2
- Criterion 3
```

## Customizing Existing Agents

### Modifying Agent Behavior

You can customize an agent's behavior by modifying its configuration in `workflow.yaml`:

```yaml
agents:
  worker:
    model: "sonnet"  # Change to opus for complex tasks
    tools:
      - Read
      - Write
      - Edit
      - Bash
      - Glob
      - Grep
    coding:
      language: "python"        # Changed from typescript
      test_framework: "pytest"  # Changed from jest
      lint_command: "ruff check ."
      test_command: "pytest"
      build_command: "python -m build"
    verification:
      run_tests: true
      run_lint: true
      run_build: true
      coverage_threshold: 90    # Increased from 80
```

### Changing Model Selection

Each agent can use a different AI model based on task complexity:

```yaml
agents:
  # Simple, fast tasks
  collector:
    model: "haiku"

  # Standard complexity
  prd-writer:
    model: "sonnet"

  # Complex reasoning
  impact-analyzer:
    model: "opus"
```

**Model Selection Guidelines:**

| Model | Best For | Context Window | Speed |
|-------|----------|----------------|-------|
| Haiku | Quick searches, simple transformations, status checks | 200K | Fastest |
| Sonnet | Document generation, code generation, analysis | 200K | Balanced |
| Opus | Complex reasoning, architecture decisions, critical reviews | 200K | Slowest |

### Adding Tools to Agents

Agents can access various tools. Add or remove tools in the `agents` section of `workflow.yaml`:

```yaml
agents:
  my-custom-agent:
    model: "sonnet"
    tools:
      - Read        # Read files
      - Write       # Write new files
      - Edit        # Edit existing files
      - Bash        # Execute shell commands
      - Glob        # Find files by pattern
      - Grep        # Search file contents
      - WebFetch    # Fetch web content
      - WebSearch   # Search the web
```

**Available Tools:**

| Tool | Description | Use Cases |
|------|-------------|-----------|
| Read | Read file contents | Reading configuration, source code |
| Write | Create new files | Generating documents, creating code |
| Edit | Modify existing files | Updating configuration, fixing code |
| Bash | Execute shell commands | Running tests, build commands |
| Glob | Find files by pattern | `**/*.ts`, `src/**/*.py` |
| Grep | Search file contents | Finding function definitions |
| WebFetch | Fetch URL content | API documentation, external resources |
| WebSearch | Search the web | Research, finding solutions |

### Example: Custom Worker for Python Projects

```yaml
# In workflow.yaml
agents:
  worker:
    model: "sonnet"
    tools:
      - Read
      - Write
      - Edit
      - Bash
      - Glob
      - Grep
    coding:
      language: "python"
      test_framework: "pytest"
      lint_command: "ruff check . && mypy ."
      test_command: "pytest --cov=src --cov-report=xml"
      build_command: "python -m build"
    verification:
      run_tests: true
      run_lint: true
      run_build: true
      coverage_threshold: 85
```

## Creating New Agents

### Step 1: Define Agent Metadata

Add the agent to `.ad-sdlc/config/agents.yaml`:

```yaml
agents:
  # ... existing agents ...

  security-scanner:
    id: "security-scanner"
    name: "Security Scanner Agent"
    korean_name: "보안 스캐너 에이전트"
    description: "Scans code for security vulnerabilities and compliance issues"
    definition_file: ".claude/agents/security-scanner.md"
    category: "execution"
    order: 9

    capabilities:
      - "vulnerability_detection"
      - "dependency_audit"
      - "secret_detection"
      - "compliance_check"

    io:
      inputs:
        - source_files
        - dependency_files
      outputs:
        - security_report.yaml

    metrics:
      avg_duration_seconds: 180
      success_rate: 0.95
```

### Step 2: Create Agent Definition

Create `.claude/agents/security-scanner.md`:

```markdown
# Security Scanner Agent

## Role

Scan the codebase for security vulnerabilities, exposed secrets, and
compliance issues before code is merged.

## Responsibilities

1. Scan source code for common vulnerability patterns (OWASP Top 10)
2. Audit dependencies for known vulnerabilities
3. Detect hardcoded secrets and credentials
4. Check compliance with security policies
5. Generate detailed security report with remediation suggestions

## Workflow

### Input Processing
1. Receive list of changed files from Worker Agent
2. Load project security policy configuration

### Vulnerability Scanning
1. Run static analysis for security patterns
2. Check for injection vulnerabilities
3. Identify authentication/authorization issues
4. Detect insecure data handling

### Dependency Audit
1. Parse dependency files (package.json, requirements.txt, etc.)
2. Check dependencies against vulnerability databases
3. Identify outdated packages with known CVEs

### Secret Detection
1. Scan for API keys, passwords, tokens
2. Check configuration files
3. Review environment variable usage

### Report Generation
1. Compile findings with severity levels
2. Provide remediation guidance
3. Generate compliance summary

## Input/Output

### Inputs
- `changed_files`: List of modified source files
- `dependency_files`: package.json, requirements.txt, etc.
- `security_policy.yaml`: Project security configuration

### Outputs
- `security_report.yaml`: Detailed security findings

## Quality Criteria

- All high-severity issues must be flagged
- Zero false positives for secret detection
- Clear remediation steps for each finding
- Compliance status clearly indicated
```

### Step 3: Register in Category

Update the categories section in `agents.yaml`:

```yaml
categories:
  execution:
    name: "Execution"
    description: "Agents that implement code and review PRs"
    agents:
      - worker
      - pr-reviewer
      - security-scanner  # Add new agent
    execution_mode: "parallel"
```

### Step 4: Define Dependencies

Add dependency relationships:

```yaml
relationships:
  dependencies:
    # ... existing dependencies ...
    security-scanner:
      requires: [worker]
    pr-reviewer:
      requires: [worker, security-scanner]  # Updated

  data_flow:
    # ... existing data flows ...
    - from: worker
      to: security-scanner
      data: changed_files

    - from: security-scanner
      to: pr-reviewer
      data: security_report.yaml
```

### Step 5: Configure in Workflow

Add agent configuration to `workflow.yaml`:

```yaml
agents:
  # ... existing agents ...

  security-scanner:
    model: "sonnet"
    tools:
      - Read
      - Write
      - Glob
      - Grep
      - Bash
    scanning:
      owasp_top_10: true
      dependency_audit: true
      secret_detection: true
      compliance_standards:
        - "SOC2"
        - "GDPR"
    severity_threshold: "medium"  # Block on medium or higher
```

### Step 6: Add to Pipeline Stage

Update the pipeline in `workflow.yaml`:

```yaml
pipeline:
  modes:
    greenfield:
      stages:
        # ... existing stages ...

        - name: "security_scan"
          agent: "security-scanner"
          description: "Scan implementation for security issues"
          inputs:
            - "${scratchpad_dir}/progress/${project_id}/results/*.yaml"
          outputs:
            - "${scratchpad_dir}/security/${project_id}/security_report.yaml"
          next: "review"
          approval_required: false

        - name: "review"
          agent: "pr-reviewer"
          # ... now receives security report ...
```

## Integrating with Workflow

### Adding Approval Gates

Control human review points:

```yaml
pipeline:
  modes:
    greenfield:
      stages:
        - name: "security_scan"
          agent: "security-scanner"
          approval_required: true  # Require human approval
          # ...
```

### Parallel Execution

Run multiple agents simultaneously:

```yaml
- name: "parallel_analysis"
  parallel: true
  substages:
    - name: "security_scan"
      agent: "security-scanner"
    - name: "performance_check"
      agent: "performance-analyzer"
  next: "review"
```

### Conditional Stages

Execute stages based on conditions (in custom implementation):

```yaml
- name: "security_scan"
  agent: "security-scanner"
  condition:
    type: "file_pattern"
    pattern: "*.ts"
    min_changes: 10
```

## Best Practices

### 1. Single Responsibility

Each agent should do one thing well:

```yaml
# Good: Focused agents
security-scanner:    # Only security scanning
performance-analyzer: # Only performance analysis
documentation-gen:   # Only documentation

# Avoid: Overloaded agents
super-agent:         # Does security, performance, AND documentation
```

### 2. Clear Input/Output Contracts

Define explicit I/O formats:

```yaml
io:
  inputs:
    - type: yaml
      file: changed_files.yaml
      schema: ".ad-sdlc/schemas/changed_files.schema.json"
  outputs:
    - type: yaml
      file: security_report.yaml
      schema: ".ad-sdlc/schemas/security_report.schema.json"
```

### 3. Appropriate Model Selection

Match model to task complexity:

| Task Type | Recommended Model |
|-----------|-------------------|
| File searching, simple parsing | Haiku |
| Document generation, standard code | Sonnet |
| Architecture decisions, complex analysis | Opus |

### 4. Minimal Tool Access

Only include tools the agent needs:

```yaml
# Document reader needs only file access
document-reader:
  tools: [Read, Glob, Grep]

# Worker needs file modification
worker:
  tools: [Read, Write, Edit, Bash, Glob, Grep]
```

### 5. Idempotency

Design agents to produce consistent output:

- Same input should produce same output
- Avoid side effects outside defined outputs
- Use deterministic processing logic

### 6. Error Handling

Define how agents handle failures:

```yaml
retry_policy:
  max_attempts: 3
  backoff: "exponential"
  base_delay_seconds: 5

on_failure:
  action: "report"  # report, skip, or abort
  notification: true
```

## Testing Custom Agents

### Unit Testing

Test agent configuration:

```typescript
import { AgentRegistry } from 'ad-sdlc';

describe('SecurityScanner Agent', () => {
  it('should be properly configured', () => {
    const registry = new AgentRegistry();
    const agent = registry.getAgent('security-scanner');

    expect(agent).toBeDefined();
    expect(agent.capabilities).toContain('vulnerability_detection');
    expect(agent.io.outputs).toContain('security_report.yaml');
  });
});
```

### Integration Testing

Test agent in isolation:

```typescript
import { AgentRunner } from 'ad-sdlc';

describe('SecurityScanner Integration', () => {
  it('should detect vulnerabilities', async () => {
    const runner = new AgentRunner('security-scanner');

    const result = await runner.run({
      changed_files: ['src/auth.ts', 'src/api.ts'],
      dependency_files: ['package.json'],
    });

    expect(result.status).toBe('success');
    expect(result.outputs['security_report.yaml']).toBeDefined();
  });
});
```

### End-to-End Testing

Test agent in full pipeline:

```typescript
import { Pipeline } from 'ad-sdlc';

describe('Pipeline with SecurityScanner', () => {
  it('should run security scan before review', async () => {
    const pipeline = new Pipeline({ mode: 'greenfield' });
    const execution = await pipeline.run({
      startFrom: 'implementation',
      stopAt: 'review',
    });

    expect(execution.stages).toContain('security_scan');
    expect(execution.artifacts['security_report.yaml']).toBeDefined();
  });
});
```

### Manual Testing

Test agent manually using the CLI:

```bash
# Validate agent configuration
ad-sdlc validate-agent security-scanner

# Run agent in isolation
ad-sdlc run-agent security-scanner \
  --input changed_files.yaml \
  --output security_report.yaml

# Dry run in pipeline
ad-sdlc run --mode greenfield --dry-run --start-from security_scan
```

## Troubleshooting

### Agent Not Found

```
Error: Agent 'my-agent' not found in registry
```

**Solutions:**
1. Check agent ID matches in `agents.yaml`
2. Verify `definition_file` path exists
3. Ensure agent is added to a category

### Tool Access Denied

```
Error: Tool 'Bash' not allowed for agent 'my-agent'
```

**Solutions:**
1. Add the tool to agent's `tools` list in `workflow.yaml`
2. Verify tool name is correctly spelled

### Dependency Cycle Detected

```
Error: Circular dependency detected: A -> B -> C -> A
```

**Solutions:**
1. Review `dependencies` section in `agents.yaml`
2. Remove circular references
3. Consider restructuring agent responsibilities

### Input File Not Found

```
Error: Required input 'collected_info.yaml' not found
```

**Solutions:**
1. Ensure previous stage completed successfully
2. Check file path in scratchpad directory
3. Verify `io.inputs` configuration matches actual files

### Agent Timeout

```
Error: Agent 'my-agent' timed out after 600000ms
```

**Solutions:**
1. Increase timeout in `workflow.yaml`:
   ```yaml
   timeouts:
     my_agent_stage: 900  # 15 minutes
   ```
2. Break task into smaller subtasks
3. Consider using a faster model for simpler parts

## Related Documentation

- [Workflow Configuration](../config.md)
- [Enhancement Mode Guide](./enhancement-mode.md)
- [System Architecture](../system-architecture.md)
- [Agent Registry Reference](../reference/agents-yaml.md)
