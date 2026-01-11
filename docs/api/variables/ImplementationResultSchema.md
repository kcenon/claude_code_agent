[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImplementationResultSchema

# Variable: ImplementationResultSchema

> `const` **ImplementationResultSchema**: `ZodObject`\<\{ `schemaVersion`: `ZodDefault`\<`ZodString`\>; `orderId`: `ZodString`; `issueId`: `ZodString`; `status`: `ZodEnum`\<\{ `blocked`: `"blocked"`; `completed`: `"completed"`; `failed`: `"failed"`; \}\>; `branchName`: `ZodString`; `changes`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `filePath`: `ZodString`; `changeType`: `ZodEnum`\<\{ `create`: `"create"`; `delete`: `"delete"`; `modify`: `"modify"`; \}\>; `linesAdded`: `ZodNumber`; `linesRemoved`: `ZodNumber`; \}, `$strip`\>\>\>\>; `testsAdded`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `filePath`: `ZodString`; `testCount`: `ZodNumber`; `passed`: `ZodOptional`\<`ZodNumber`\>; `failed`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>\>\>\>; `completedAt`: `ZodISODateTime`; `errorMessage`: `ZodOptional`\<`ZodString`\>; `commitHash`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:290](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L290)
