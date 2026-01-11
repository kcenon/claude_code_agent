[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodebaseDirectoryStructure

# Interface: CodebaseDirectoryStructure

Defined in: [src/codebase-analyzer/types.ts:159](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L159)

Directory structure analysis

## Properties

### sourceDirs

> `readonly` **sourceDirs**: readonly [`SourceDirectory`](SourceDirectory.md)[]

Defined in: [src/codebase-analyzer/types.ts:161](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L161)

Source directories

***

### testDirs

> `readonly` **testDirs**: readonly [`TestDirectory`](TestDirectory.md)[]

Defined in: [src/codebase-analyzer/types.ts:163](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L163)

Test directories

***

### configDirs

> `readonly` **configDirs**: readonly [`ConfigDirectory`](ConfigDirectory.md)[]

Defined in: [src/codebase-analyzer/types.ts:165](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L165)

Configuration directories

***

### buildFiles

> `readonly` **buildFiles**: readonly [`BuildFile`](BuildFile.md)[]

Defined in: [src/codebase-analyzer/types.ts:167](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L167)

Build files found
