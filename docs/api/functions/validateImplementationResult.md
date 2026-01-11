[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / validateImplementationResult

# Function: validateImplementationResult()

> **validateImplementationResult**(`data`): [`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `orderId`: `string`; `issueId`: `string`; `status`: `"blocked"` \| `"completed"` \| `"failed"`; `branchName`: `string`; `changes`: `object`[]; `testsAdded`: `object`[]; `completedAt`: `string`; `errorMessage?`: `string`; `commitHash?`: `string`; \}\>

Defined in: [src/scratchpad/validation.ts:159](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L159)

Validate ImplementationResult data

## Parameters

### data

`unknown`

Data to validate

## Returns

[`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `orderId`: `string`; `issueId`: `string`; `status`: `"blocked"` \| `"completed"` \| `"failed"`; `branchName`: `string`; `changes`: `object`[]; `testsAdded`: `object`[]; `completedAt`: `string`; `errorMessage?`: `string`; `commitHash?`: `string`; \}\>

Validation result
