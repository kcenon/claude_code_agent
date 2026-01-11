[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DependencyAnalysis

# Interface: DependencyAnalysis

Defined in: [src/prd-writer/types.ts:153](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L153)

Dependency analysis result

## Properties

### totalDependencies

> `readonly` **totalDependencies**: `number`

Defined in: [src/prd-writer/types.ts:155](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L155)

Total number of dependencies

***

### missingBidirectional

> `readonly` **missingBidirectional**: readonly `string`[]

Defined in: [src/prd-writer/types.ts:157](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L157)

Dependencies that are missing reverse reference

***

### circularChains

> `readonly` **circularChains**: readonly `string`[][]

Defined in: [src/prd-writer/types.ts:159](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L159)

Circular dependency chains found
