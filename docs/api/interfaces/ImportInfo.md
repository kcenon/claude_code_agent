[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImportInfo

# Interface: ImportInfo

Defined in: [src/codebase-analyzer/types.ts:520](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L520)

Import statement information

## Properties

### sourceFile

> `readonly` **sourceFile**: `string`

Defined in: [src/codebase-analyzer/types.ts:522](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L522)

Source file path

***

### line

> `readonly` **line**: `number`

Defined in: [src/codebase-analyzer/types.ts:524](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L524)

Import statement line number

***

### rawImport

> `readonly` **rawImport**: `string`

Defined in: [src/codebase-analyzer/types.ts:526](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L526)

Raw import string

***

### resolvedPath

> `readonly` **resolvedPath**: `string` \| `null`

Defined in: [src/codebase-analyzer/types.ts:528](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L528)

Resolved module path

***

### isExternal

> `readonly` **isExternal**: `boolean`

Defined in: [src/codebase-analyzer/types.ts:530](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L530)

Whether import is external

***

### symbols

> `readonly` **symbols**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:532](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L532)

Imported symbols (if extractable)
