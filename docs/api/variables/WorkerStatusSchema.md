[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / WorkerStatusSchema

# Variable: WorkerStatusSchema

> `const` **WorkerStatusSchema**: `ZodObject`\<\{ `id`: `ZodString`; `status`: `ZodEnum`\<\{ `error`: `"error"`; `idle`: `"idle"`; `working`: `"working"`; \}\>; `currentIssue`: `ZodNullable`\<`ZodString`\>; `startedAt`: `ZodNullable`\<`ZodISODateTime`\>; `completedTasks`: `ZodNumber`; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:366](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L366)
