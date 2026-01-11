[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InputSource

# Interface: InputSource

Defined in: [src/collector/types.ts:32](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L32)

Input source metadata

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/collector/types.ts:34](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L34)

Unique identifier for the source

***

### type

> `readonly` **type**: [`InputSourceType`](../type-aliases/InputSourceType.md)

Defined in: [src/collector/types.ts:36](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L36)

Type of input source

***

### reference

> `readonly` **reference**: `string`

Defined in: [src/collector/types.ts:38](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L38)

Reference to the source (file path, URL, or description)

***

### content

> `readonly` **content**: `string`

Defined in: [src/collector/types.ts:40](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L40)

Raw content from the source

***

### extractedAt

> `readonly` **extractedAt**: `string`

Defined in: [src/collector/types.ts:42](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L42)

When the content was extracted

***

### summary?

> `readonly` `optional` **summary**: `string`

Defined in: [src/collector/types.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L44)

Optional summary of the content
