[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodeMetrics

# Interface: CodeMetrics

Defined in: [src/codebase-analyzer/types.ts:237](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L237)

Code metrics

## Properties

### totalFiles

> `readonly` **totalFiles**: `number`

Defined in: [src/codebase-analyzer/types.ts:239](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L239)

Total number of files

***

### totalLines

> `readonly` **totalLines**: `number`

Defined in: [src/codebase-analyzer/types.ts:241](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L241)

Total lines of code

***

### totalSourceFiles

> `readonly` **totalSourceFiles**: `number`

Defined in: [src/codebase-analyzer/types.ts:243](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L243)

Total source files (excluding tests)

***

### totalTestFiles

> `readonly` **totalTestFiles**: `number`

Defined in: [src/codebase-analyzer/types.ts:245](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L245)

Total test files

***

### languages

> `readonly` **languages**: readonly [`LanguageStats`](LanguageStats.md)[]

Defined in: [src/codebase-analyzer/types.ts:247](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L247)

Language distribution
