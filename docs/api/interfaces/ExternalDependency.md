[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ExternalDependency

# Interface: ExternalDependency

Defined in: [src/codebase-analyzer/types.ts:317](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L317)

External package dependency

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/codebase-analyzer/types.ts:319](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L319)

Package name

***

### version

> `readonly` **version**: `string`

Defined in: [src/codebase-analyzer/types.ts:321](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L321)

Version specification

***

### type

> `readonly` **type**: [`PackageDependencyType`](../type-aliases/PackageDependencyType.md)

Defined in: [src/codebase-analyzer/types.ts:323](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L323)

Dependency type

***

### usedBy

> `readonly` **usedBy**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:325](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L325)

Modules that use this package
