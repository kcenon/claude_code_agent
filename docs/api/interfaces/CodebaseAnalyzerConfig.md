[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodebaseAnalyzerConfig

# Interface: CodebaseAnalyzerConfig

Defined in: [src/codebase-analyzer/types.ts:389](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L389)

Codebase Analyzer Agent configuration

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/codebase-analyzer/types.ts:391](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L391)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### sourcePatterns?

> `readonly` `optional` **sourcePatterns**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:393](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L393)

Source directory patterns to scan

***

### testPatterns?

> `readonly` `optional` **testPatterns**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:395](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L395)

Test directory patterns to scan

***

### excludeDirs?

> `readonly` `optional` **excludeDirs**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:397](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L397)

Directories to exclude from analysis

***

### includeExtensions?

> `readonly` `optional` **includeExtensions**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:399](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L399)

File extensions to analyze

***

### maxFiles?

> `readonly` `optional` **maxFiles**: `number`

Defined in: [src/codebase-analyzer/types.ts:401](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L401)

Maximum files to analyze (0 = unlimited)

***

### maxFileSize?

> `readonly` `optional` **maxFileSize**: `number`

Defined in: [src/codebase-analyzer/types.ts:403](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L403)

Maximum file size to process (in bytes)

***

### analyzeDependencies?

> `readonly` `optional` **analyzeDependencies**: `boolean`

Defined in: [src/codebase-analyzer/types.ts:405](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L405)

Whether to analyze dependencies

***

### detectPatterns?

> `readonly` `optional` **detectPatterns**: `boolean`

Defined in: [src/codebase-analyzer/types.ts:407](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L407)

Whether to detect patterns

***

### calculateMetrics?

> `readonly` `optional` **calculateMetrics**: `boolean`

Defined in: [src/codebase-analyzer/types.ts:409](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L409)

Whether to calculate metrics

***

### conventionSampleRatio?

> `readonly` `optional` **conventionSampleRatio**: `number`

Defined in: [src/codebase-analyzer/types.ts:411](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L411)

Sample ratio for convention detection (0.0 - 1.0)
