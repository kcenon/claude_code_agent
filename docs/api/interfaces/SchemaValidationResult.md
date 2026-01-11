[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SchemaValidationResult

# Interface: SchemaValidationResult\<T\>

Defined in: [src/scratchpad/validation.ts:42](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L42)

Validation result

## Type Parameters

### T

`T`

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/scratchpad/validation.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L44)

Whether validation passed

***

### data?

> `readonly` `optional` **data**: `T`

Defined in: [src/scratchpad/validation.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L46)

Validated and transformed data (if success)

***

### errors?

> `readonly` `optional` **errors**: readonly [`FieldError`](FieldError.md)[]

Defined in: [src/scratchpad/validation.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L48)

List of validation errors (if failure)

***

### schemaVersion

> `readonly` **schemaVersion**: `string`

Defined in: [src/scratchpad/validation.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L50)

Schema version used for validation
