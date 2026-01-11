[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactArchitectureOverview

# Interface: ImpactArchitectureOverview

Defined in: [src/impact-analyzer/types.ts:353](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L353)

Architecture overview (from Codebase Analyzer)

## Properties

### type

> `readonly` **type**: `string`

Defined in: [src/impact-analyzer/types.ts:354](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L354)

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/impact-analyzer/types.ts:355](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L355)

***

### patterns?

> `readonly` `optional` **patterns**: readonly `object`[]

Defined in: [src/impact-analyzer/types.ts:356](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L356)

***

### structure?

> `readonly` `optional` **structure**: `object`

Defined in: [src/impact-analyzer/types.ts:361](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L361)

#### sourceDirs?

> `readonly` `optional` **sourceDirs**: readonly `object`[]

#### testDirs?

> `readonly` `optional` **testDirs**: readonly `object`[]

***

### metrics?

> `readonly` `optional` **metrics**: `object`

Defined in: [src/impact-analyzer/types.ts:365](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L365)

#### totalFiles

> `readonly` **totalFiles**: `number`

#### totalLines

> `readonly` **totalLines**: `number`

#### languages?

> `readonly` `optional` **languages**: readonly `object`[]
