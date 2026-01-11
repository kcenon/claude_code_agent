[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ArchitectureOverview

# Interface: ArchitectureOverview

Defined in: [src/codebase-analyzer/types.ts:267](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L267)

Architecture overview output

## Properties

### type

> `readonly` **type**: [`ArchitectureType`](../type-aliases/ArchitectureType.md)

Defined in: [src/codebase-analyzer/types.ts:269](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L269)

Detected architecture type

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/codebase-analyzer/types.ts:271](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L271)

Confidence level (0.0 - 1.0)

***

### patterns

> `readonly` **patterns**: readonly [`DetectedPattern`](DetectedPattern.md)[]

Defined in: [src/codebase-analyzer/types.ts:273](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L273)

Detected patterns

***

### structure

> `readonly` **structure**: [`CodebaseDirectoryStructure`](CodebaseDirectoryStructure.md)

Defined in: [src/codebase-analyzer/types.ts:275](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L275)

Directory structure

***

### conventions

> `readonly` **conventions**: [`CodingConventions`](CodingConventions.md)

Defined in: [src/codebase-analyzer/types.ts:277](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L277)

Coding conventions

***

### metrics

> `readonly` **metrics**: [`CodeMetrics`](CodeMetrics.md)

Defined in: [src/codebase-analyzer/types.ts:279](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L279)

Code metrics

***

### buildSystem

> `readonly` **buildSystem**: [`BuildSystemInfo`](BuildSystemInfo.md)

Defined in: [src/codebase-analyzer/types.ts:281](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L281)

Build system information
