[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / NonFunctionalRequirementSchema

# Variable: NonFunctionalRequirementSchema

> `const` **NonFunctionalRequirementSchema**: `ZodObject`\<\{ `id`: `ZodString`; `category`: `ZodEnum`\<\{ `security`: `"security"`; `performance`: `"performance"`; `scalability`: `"scalability"`; `usability`: `"usability"`; `reliability`: `"reliability"`; `maintainability`: `"maintainability"`; \}\>; `title`: `ZodString`; `description`: `ZodString`; `metric`: `ZodOptional`\<`ZodString`\>; `target`: `ZodOptional`\<`ZodString`\>; `priority`: `ZodEnum`\<\{ `P0`: `"P0"`; `P1`: `"P1"`; `P2`: `"P2"`; `P3`: `"P3"`; \}\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:105](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L105)
