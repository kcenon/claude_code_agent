[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ExtractedConstraint

# Interface: ExtractedConstraint

Defined in: [src/collector/types.ts:94](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L94)

Extracted constraint from input

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/collector/types.ts:96](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L96)

Generated constraint ID (e.g., CON-001)

***

### description

> `readonly` **description**: `string`

Defined in: [src/collector/types.ts:98](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L98)

Constraint description

***

### reason?

> `readonly` `optional` **reason**: `string`

Defined in: [src/collector/types.ts:100](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L100)

Reason for the constraint

***

### type

> `readonly` **type**: `"technical"` \| `"business"` \| `"regulatory"` \| `"resource"`

Defined in: [src/collector/types.ts:102](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L102)

Type of constraint

***

### source

> `readonly` **source**: `string`

Defined in: [src/collector/types.ts:104](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L104)

Source reference

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/collector/types.ts:106](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L106)

Confidence score (0.0 - 1.0)
