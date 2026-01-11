[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / assertWorkOrder

# Function: assertWorkOrder()

> **assertWorkOrder**(`data`): `object`

Defined in: [src/scratchpad/validation.ts:236](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L236)

Assert that data is valid WorkOrder

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

### issueUrl

> **issueUrl**: `string`

### createdAt

> **createdAt**: `string`

### priority

> **priority**: `number`

### context

> **context**: `object` = `WorkOrderContextSchema`

#### context.sdsComponent?

> `optional` **sdsComponent**: `string`

#### context.srsFeature?

> `optional` **srsFeature**: `string`

#### context.prdRequirement?

> `optional` **prdRequirement**: `string`

#### context.relatedFiles

> **relatedFiles**: `object`[]

#### context.dependenciesStatus

> **dependenciesStatus**: `object`[]

### acceptanceCriteria

> **acceptanceCriteria**: `string`[]

## Throws

SchemaValidationError if validation fails
