[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionDependencyNode

# Interface: RegressionDependencyNode

Defined in: [src/regression-tester/types.ts:426](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L426)

Dependency graph node (from Codebase Analyzer)

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/regression-tester/types.ts:428](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L428)

Node identifier

***

### type

> `readonly` **type**: `"external"` \| `"internal"`

Defined in: [src/regression-tester/types.ts:430](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L430)

Node type

***

### path?

> `readonly` `optional` **path**: `string`

Defined in: [src/regression-tester/types.ts:432](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L432)

File path

***

### exports

> `readonly` **exports**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:434](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L434)

Exported symbols
