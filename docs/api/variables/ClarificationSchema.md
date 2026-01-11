[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ClarificationSchema

# Variable: ClarificationSchema

> `const` **ClarificationSchema**: `ZodObject`\<\{ `id`: `ZodString`; `category`: `ZodEnum`\<\{ `priority`: `"priority"`; `requirement`: `"requirement"`; `constraint`: `"constraint"`; `assumption`: `"assumption"`; \}\>; `question`: `ZodString`; `answer`: `ZodOptional`\<`ZodString`\>; `timestamp`: `ZodOptional`\<`ZodISODateTime`\>; `required`: `ZodDefault`\<`ZodOptional`\<`ZodBoolean`\>\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:164](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L164)
