[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ChangedFile

# Interface: ChangedFile

Defined in: [src/regression-tester/types.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L71)

Changed file information

## Properties

### path

> `readonly` **path**: `string`

Defined in: [src/regression-tester/types.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L73)

File path relative to project root

***

### changeType

> `readonly` **changeType**: [`RegressionChangeType`](../type-aliases/RegressionChangeType.md)

Defined in: [src/regression-tester/types.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L75)

Type of change

***

### linesChanged

> `readonly` **linesChanged**: `number`

Defined in: [src/regression-tester/types.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L77)

Number of lines changed

***

### oldPath?

> `readonly` `optional` **oldPath**: `string`

Defined in: [src/regression-tester/types.ts:79](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L79)

Old path if renamed
