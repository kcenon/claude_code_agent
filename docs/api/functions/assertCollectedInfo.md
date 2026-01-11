[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / assertCollectedInfo

# Function: assertCollectedInfo()

> **assertCollectedInfo**(`data`): `object`

Defined in: [src/scratchpad/validation.ts:217](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L217)

Assert that data is valid CollectedInfo

## Parameters

### data

`unknown`

Data to validate

## Returns

`object`

Validated data

### schemaVersion

> **schemaVersion**: `string`

### projectId

> **projectId**: `string`

### status

> **status**: `"completed"` \| `"collecting"` \| `"clarifying"` = `CollectionStatusSchema`

### project

> **project**: `object`

#### project.name

> **name**: `string`

#### project.description

> **description**: `string`

### requirements

> **requirements**: `object`

#### requirements.functional

> **functional**: `object`[]

#### requirements.nonFunctional

> **nonFunctional**: `object`[]

### constraints

> **constraints**: `object`[]

### assumptions

> **assumptions**: `object`[]

### dependencies

> **dependencies**: `object`[]

### clarifications

> **clarifications**: `object`[]

### sources

> **sources**: `object`[]

### createdAt

> **createdAt**: `string`

### updatedAt

> **updatedAt**: `string`

### completedAt?

> `optional` **completedAt**: `string`

## Throws

SchemaValidationError if validation fails
