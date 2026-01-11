[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / assertImplementationResult

# Function: assertImplementationResult()

> **assertImplementationResult**(`data`): `object`

Defined in: [src/scratchpad/validation.ts:255](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L255)

Assert that data is valid ImplementationResult

## Parameters

### data

`unknown`

Data to validate

## Returns

`object`

Validated data

### schemaVersion

> **schemaVersion**: `string`

### orderId

> **orderId**: `string`

### issueId

> **issueId**: `string`

### status

> **status**: `"blocked"` \| `"completed"` \| `"failed"` = `ImplementationStatusSchema`

### branchName

> **branchName**: `string`

### changes

> **changes**: `object`[]

### testsAdded

> **testsAdded**: `object`[]

### completedAt

> **completedAt**: `string`

### errorMessage?

> `optional` **errorMessage**: `string`

### commitHash?

> `optional` **commitHash**: `string`

## Throws

SchemaValidationError if validation fails
