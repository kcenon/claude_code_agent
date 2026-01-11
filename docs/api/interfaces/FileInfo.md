[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FileInfo

# Interface: FileInfo

Defined in: [src/codebase-analyzer/types.ts:502](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L502)

File information during scanning

## Properties

### path

> `readonly` **path**: `string`

Defined in: [src/codebase-analyzer/types.ts:504](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L504)

File path

***

### extension

> `readonly` **extension**: `string`

Defined in: [src/codebase-analyzer/types.ts:506](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L506)

File extension

***

### size

> `readonly` **size**: `number`

Defined in: [src/codebase-analyzer/types.ts:508](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L508)

File size in bytes

***

### language

> `readonly` **language**: [`ProgrammingLanguage`](../type-aliases/ProgrammingLanguage.md)

Defined in: [src/codebase-analyzer/types.ts:510](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L510)

Programming language

***

### isTest

> `readonly` **isTest**: `boolean`

Defined in: [src/codebase-analyzer/types.ts:512](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L512)

Whether it's a test file

***

### lineCount

> `readonly` **lineCount**: `number`

Defined in: [src/codebase-analyzer/types.ts:514](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L514)

Line count
