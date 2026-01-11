[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / validateControllerState

# Function: validateControllerState()

> **validateControllerState**(`data`): [`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `sessionId`: `string`; `projectId`: `string`; `currentPhase`: `string`; `startedAt`: `string`; `updatedAt`: `string`; `queue`: \{ `pending`: `string`[]; `inProgress`: `string`[]; `completed`: `string`[]; `blocked`: `string`[]; \}; `workers`: `object`[]; `totalIssues`: `number`; `completedIssues`: `number`; `failedIssues`: `number`; \}\>

Defined in: [src/scratchpad/validation.ts:181](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L181)

Validate ControllerState data

## Parameters

### data

`unknown`

Data to validate

## Returns

[`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `sessionId`: `string`; `projectId`: `string`; `currentPhase`: `string`; `startedAt`: `string`; `updatedAt`: `string`; `queue`: \{ `pending`: `string`[]; `inProgress`: `string`[]; `completed`: `string`[]; `blocked`: `string`[]; \}; `workers`: `object`[]; `totalIssues`: `number`; `completedIssues`: `number`; `failedIssues`: `number`; \}\>

Validation result
