[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ExtractedDependency

# Interface: ExtractedDependency

Defined in: [src/collector/types.ts:128](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L128)

Extracted dependency from input

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/collector/types.ts:130](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L130)

Dependency name

***

### type

> `readonly` **type**: `"api"` \| `"library"` \| `"service"` \| `"tool"`

Defined in: [src/collector/types.ts:132](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L132)

Type of dependency

***

### version?

> `readonly` `optional` **version**: `string`

Defined in: [src/collector/types.ts:134](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L134)

Version if specified

***

### purpose?

> `readonly` `optional` **purpose**: `string`

Defined in: [src/collector/types.ts:136](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L136)

Purpose of the dependency

***

### required

> `readonly` **required**: `boolean`

Defined in: [src/collector/types.ts:138](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L138)

Whether it's required or optional

***

### source

> `readonly` **source**: `string`

Defined in: [src/collector/types.ts:140](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L140)

Source reference
