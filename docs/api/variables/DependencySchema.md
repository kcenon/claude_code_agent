[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DependencySchema

# Variable: DependencySchema

> `const` **DependencySchema**: `ZodObject`\<\{ `name`: `ZodString`; `type`: `ZodEnum`\<\{ `api`: `"api"`; `library`: `"library"`; `service`: `"service"`; `tool`: `"tool"`; \}\>; `version`: `ZodOptional`\<`ZodString`\>; `purpose`: `ZodOptional`\<`ZodString`\>; `required`: `ZodDefault`\<`ZodOptional`\<`ZodBoolean`\>\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:151](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L151)
