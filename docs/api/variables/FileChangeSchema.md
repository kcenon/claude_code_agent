[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FileChangeSchema

# Variable: FileChangeSchema

> `const` **FileChangeSchema**: `ZodObject`\<\{ `filePath`: `ZodString`; `changeType`: `ZodEnum`\<\{ `create`: `"create"`; `delete`: `"delete"`; `modify`: `"modify"`; \}\>; `linesAdded`: `ZodNumber`; `linesRemoved`: `ZodNumber`; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:266](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L266)
