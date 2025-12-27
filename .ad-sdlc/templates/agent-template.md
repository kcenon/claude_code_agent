---
name: {agent-name}
description: |
  {Brief description of the agent's purpose and when to use it.}
  PROACTIVELY use this agent when {trigger conditions}.
tools:
  - Read
  - Write
  # Add other tools as needed: Edit, Bash, Glob, Grep, WebFetch, WebSearch
model: sonnet  # Options: sonnet, opus
---

# {Agent Name} Agent

## Metadata

- **ID**: {agent-id}
- **Version**: 1.0.0
- **Category**: {document_pipeline|issue_management|execution}
- **Order**: {execution_order}

## Role

You are the {Agent Name} Agent responsible for {primary_responsibility}.

## Primary Responsibilities

1. **{Responsibility 1}**
   - {Sub-task 1}
   - {Sub-task 2}
   - {Sub-task 3}

2. **{Responsibility 2}**
   - {Sub-task 1}
   - {Sub-task 2}
   - {Sub-task 3}

3. **{Responsibility 3}**
   - {Sub-task 1}
   - {Sub-task 2}
   - {Sub-task 3}

## Input Specification

### Expected Input Files

| File | Path | Format | Description |
|------|------|--------|-------------|
| {Input 1} | `.ad-sdlc/scratchpad/{type}/{project_id}/{file}` | YAML/JSON/MD | {Description} |

### Input Validation

- {Validation requirement 1}
- {Validation requirement 2}

## Output Specification

### Output Files

| File | Path | Format | Description |
|------|------|--------|-------------|
| {Output 1} | `.ad-sdlc/scratchpad/{type}/{project_id}/{file}` | YAML/JSON/MD | {Description} |

### Output Schema

```yaml
# Define the output schema here
{field_1}: {type}
{field_2}: {type}
{nested_field}:
  - {sub_field_1}: {type}
    {sub_field_2}: {type}
```

### Quality Criteria

- {Quality requirement 1}
- {Quality requirement 2}
- {Quality requirement 3}

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    {Agent Name} Workflow                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. {STEP 1}                                                │
│     └─ {Description}                                        │
│                                                             │
│  2. {STEP 2}                                                │
│     └─ {Description}                                        │
│                                                             │
│  3. {STEP 3}                                                │
│     └─ {Description}                                        │
│                                                             │
│  4. {STEP 4}                                                │
│     └─ {Description}                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step-by-Step Process

1. **{Step 1 Name}**: {Description}
2. **{Step 2 Name}**: {Description}
3. **{Step 3 Name}**: {Description}
4. **{Step 4 Name}**: {Description}
5. **{Step 5 Name}**: {Description}

## Error Handling

### Retry Behavior

| Error Type | Retry Count | Backoff Strategy | Escalation |
|------------|-------------|------------------|------------|
| {Error 1} | 3 | Exponential | User notification |
| {Error 2} | 1 | None | Immediate escalation |

### Common Errors

1. **{Error Type 1}**
   - **Cause**: {Description}
   - **Resolution**: {How to handle}

2. **{Error Type 2}**
   - **Cause**: {Description}
   - **Resolution**: {How to handle}

### Escalation Criteria

- {When to escalate to user}
- {Critical failure conditions}

## Examples

### Example 1: {Scenario Name}

**Input**:
```yaml
# Example input
{sample_input}
```

**Expected Output**:
```yaml
# Example output
{sample_output}
```

### Example 2: {Scenario Name}

**Input**:
```yaml
# Example input
{sample_input}
```

**Expected Output**:
```yaml
# Example output
{sample_output}
```

## Best Practices

- {Best practice 1}
- {Best practice 2}
- {Best practice 3}
- {Best practice 4}

## Related Agents

| Agent | Relationship | Data Exchange |
|-------|--------------|---------------|
| {Agent 1} | Upstream | Receives {data} from |
| {Agent 2} | Downstream | Sends {data} to |

## Notes

- {Additional note 1}
- {Additional note 2}
