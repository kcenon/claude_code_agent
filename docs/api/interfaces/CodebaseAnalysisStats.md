[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodebaseAnalysisStats

# Interface: CodebaseAnalysisStats

Defined in: [src/codebase-analyzer/types.ts:484](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L484)

Statistics about the codebase analysis process

## Properties

### filesScanned

> `readonly` **filesScanned**: `number`

Defined in: [src/codebase-analyzer/types.ts:486](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L486)

Number of files scanned

***

### filesAnalyzed

> `readonly` **filesAnalyzed**: `number`

Defined in: [src/codebase-analyzer/types.ts:488](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L488)

Number of files analyzed

***

### filesSkipped

> `readonly` **filesSkipped**: `number`

Defined in: [src/codebase-analyzer/types.ts:490](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L490)

Number of files skipped

***

### dependenciesFound

> `readonly` **dependenciesFound**: `number`

Defined in: [src/codebase-analyzer/types.ts:492](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L492)

Number of dependencies found

***

### patternsDetected

> `readonly` **patternsDetected**: `number`

Defined in: [src/codebase-analyzer/types.ts:494](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L494)

Number of patterns detected

***

### processingTimeMs

> `readonly` **processingTimeMs**: `number`

Defined in: [src/codebase-analyzer/types.ts:496](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L496)

Total processing time in milliseconds
