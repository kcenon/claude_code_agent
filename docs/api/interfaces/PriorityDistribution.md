[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PriorityDistribution

# Interface: PriorityDistribution

Defined in: [src/prd-writer/types.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L135)

Priority distribution across requirements

## Properties

### p0Count

> `readonly` **p0Count**: `number`

Defined in: [src/prd-writer/types.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L137)

Count of P0 requirements

***

### p1Count

> `readonly` **p1Count**: `number`

Defined in: [src/prd-writer/types.ts:139](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L139)

Count of P1 requirements

***

### p2Count

> `readonly` **p2Count**: `number`

Defined in: [src/prd-writer/types.ts:141](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L141)

Count of P2 requirements

***

### p3Count

> `readonly` **p3Count**: `number`

Defined in: [src/prd-writer/types.ts:143](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L143)

Count of P3 requirements

***

### isBalanced

> `readonly` **isBalanced**: `boolean`

Defined in: [src/prd-writer/types.ts:145](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L145)

Whether distribution is balanced

***

### recommendation?

> `readonly` `optional` **recommendation**: `string`

Defined in: [src/prd-writer/types.ts:147](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L147)

Recommendation if unbalanced
