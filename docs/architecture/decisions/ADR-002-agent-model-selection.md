# ADR-002: Agent Model Selection Strategy

## Status

**Accepted** - 2024-12-20

## Context

AD-SDLC uses Claude AI models to power its agents. Anthropic offers multiple model tiers:

| Model | Capabilities | Cost | Speed |
|-------|-------------|------|-------|
| **Claude Opus** | Highest capability, complex reasoning | Highest | Slowest |
| **Claude Sonnet** | Balanced capability and cost | Medium | Medium |
| **Claude Haiku** | Fast, efficient for simple tasks | Lowest | Fastest |

Each agent in our system has different requirements:
- Some need deep reasoning (PRD analysis, architecture design)
- Some need speed (status checks, simple validations)
- Some need balance (code generation, review)

We need a strategy for selecting the appropriate model for each agent.

## Decision

We will implement a **Task-Based Model Selection** strategy with the following rules:

### Model Assignment by Agent Type

| Agent | Model | Rationale |
|-------|-------|-----------|
| **Collector** | Sonnet | Balanced - needs understanding but not complex reasoning |
| **PRD Writer** | Sonnet | Good writing quality, cost-effective |
| **SRS Writer** | Sonnet | Technical writing, needs consistency |
| **SDS Writer** | Sonnet | Technical detail, architecture understanding |
| **Issue Generator** | Sonnet | Structured output, template following |
| **Controller** | Haiku | Fast decisions, simple logic |
| **Worker** | Sonnet | Code generation needs quality |
| **PR Reviewer** | Sonnet | Code review needs thoroughness |
| **Document Reader** | Haiku | Parsing, extraction - fast operations |
| **Codebase Analyzer** | Haiku | Pattern matching, fast analysis |
| **Impact Analyzer** | Sonnet | Complex reasoning about impacts |
| **Regression Tester** | Haiku | Test execution, fast feedback |

### Configuration

Models are configured in `agents.yaml`:

```yaml
agents:
  collector:
    model: sonnet
    # Can be overridden per-project

  controller:
    model: haiku
    # Fast decisions

  worker:
    model: sonnet
    fallback_model: opus  # For complex implementations
```

### Override Mechanism

Users can override model selection:

1. **Global override** in `workflow.yaml`:
   ```yaml
   global_settings:
     default_model: opus  # Use opus for all agents
   ```

2. **Per-agent override**:
   ```yaml
   agents:
     worker:
       model: opus  # Complex project needs opus
   ```

3. **Runtime override**:
   ```bash
   ad-sdlc run --model opus
   ```

### Cost Optimization Rules

1. **Start with Sonnet** for most tasks
2. **Use Haiku** for:
   - Simple parsing/extraction
   - Status checks
   - Quick validations
   - High-frequency operations

3. **Upgrade to Opus** when:
   - Complex architectural decisions needed
   - Multiple retry failures on Sonnet
   - User explicitly requests higher quality

## Consequences

### Positive

1. **Cost Efficiency**: ~40% cost reduction vs using Opus everywhere
2. **Speed**: Haiku agents complete 3-5x faster
3. **Flexibility**: Users can tune based on project needs
4. **Predictability**: Consistent model selection across runs

### Negative

1. **Complexity**: Must maintain model assignments
2. **Quality Variance**: Haiku may miss nuances that Sonnet catches
3. **Testing Burden**: Must test each agent with its assigned model

### Mitigations

1. **Quality Variance**: Use Sonnet as default, Haiku only for clearly simple tasks
2. **Testing**: Integration tests verify each agent works with assigned model
3. **Monitoring**: Track success rates per agent/model combination

## Implementation

### Agent Definition File

```markdown
---
name: worker
model: sonnet
fallback_model: opus
---

You are a software engineer implementing issues...
```

### Runtime Selection

```typescript
function selectModel(agent: AgentConfig, context: Context): Model {
  // 1. Check runtime override
  if (context.modelOverride) {
    return context.modelOverride;
  }

  // 2. Check agent-specific config
  if (agent.model) {
    return agent.model;
  }

  // 3. Check global default
  if (context.globalSettings.defaultModel) {
    return context.globalSettings.defaultModel;
  }

  // 4. Default to sonnet
  return 'sonnet';
}
```

## Related Decisions

- ADR-001: Scratchpad Pattern (model affects processing speed)
- ADR-003: Retry Strategy (fallback models on failure)

## References

- [Claude Model Documentation](https://docs.anthropic.com/claude/docs/models)
- [Agent Configuration Reference](../../reference/configuration/agents-yaml.md)
