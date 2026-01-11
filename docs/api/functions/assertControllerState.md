[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / assertControllerState

# Function: assertControllerState()

> **assertControllerState**(`data`): `object`

Defined in: [src/scratchpad/validation.ts:293](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L293)

Assert that data is valid ControllerState

## Parameters

### data

`unknown`

Data to validate

## Returns

`object`

Validated data

### schemaVersion

> **schemaVersion**: `string`

### sessionId

> **sessionId**: `string`

### projectId

> **projectId**: `string`

### currentPhase

> **currentPhase**: `string`

### startedAt

> **startedAt**: `string`

### updatedAt

> **updatedAt**: `string`

### queue

> **queue**: `object` = `IssueQueueSchema`

#### queue.pending

> **pending**: `string`[]

#### queue.inProgress

> **inProgress**: `string`[]

#### queue.completed

> **completed**: `string`[]

#### queue.blocked

> **blocked**: `string`[]

### workers

> **workers**: `object`[]

### totalIssues

> **totalIssues**: `number`

### completedIssues

> **completedIssues**: `number`

### failedIssues

> **failedIssues**: `number`

## Throws

SchemaValidationError if validation fails
