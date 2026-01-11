[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SourceDirectory

# Interface: SourceDirectory

Defined in: [src/codebase-analyzer/types.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L113)

Source directory information

## Properties

### path

> `readonly` **path**: `string`

Defined in: [src/codebase-analyzer/types.ts:115](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L115)

Directory path

***

### purpose

> `readonly` **purpose**: `string`

Defined in: [src/codebase-analyzer/types.ts:117](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L117)

Directory purpose

***

### fileCount

> `readonly` **fileCount**: `number`

Defined in: [src/codebase-analyzer/types.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L119)

Number of files

***

### primaryLanguage?

> `readonly` `optional` **primaryLanguage**: [`ProgrammingLanguage`](../type-aliases/ProgrammingLanguage.md)

Defined in: [src/codebase-analyzer/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L121)

Primary language in this directory
