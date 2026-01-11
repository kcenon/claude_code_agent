[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ReviewCommentSchema

# Variable: ReviewCommentSchema

> `const` **ReviewCommentSchema**: `ZodObject`\<\{ `filePath`: `ZodString`; `line`: `ZodNumber`; `severity`: `ZodEnum`\<\{ `info`: `"info"`; `warning`: `"warning"`; `error`: `"error"`; `suggestion`: `"suggestion"`; \}\>; `message`: `ZodString`; `category`: `ZodOptional`\<`ZodEnum`\<\{ `test`: `"test"`; `style`: `"style"`; `security`: `"security"`; `performance`: `"performance"`; `logic`: `"logic"`; \}\>\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:308](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L308)
