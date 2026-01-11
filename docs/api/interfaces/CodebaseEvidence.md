[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodebaseEvidence

# Interface: CodebaseEvidence

Defined in: [src/mode-detector/types.ts:45](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L45)

Codebase presence evidence

## Properties

### exists

> `readonly` **exists**: `boolean`

Defined in: [src/mode-detector/types.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L47)

Whether codebase exists (has source files)

***

### sourceFileCount

> `readonly` **sourceFileCount**: `number`

Defined in: [src/mode-detector/types.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L49)

Number of source files found

***

### linesOfCode

> `readonly` **linesOfCode**: `number`

Defined in: [src/mode-detector/types.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L51)

Total lines of code

***

### hasTests

> `readonly` **hasTests**: `boolean`

Defined in: [src/mode-detector/types.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L53)

Whether tests exist

***

### hasBuildSystem

> `readonly` **hasBuildSystem**: `boolean`

Defined in: [src/mode-detector/types.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L55)

Whether build system is detected
