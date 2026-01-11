[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ControllerStateSchema

# Variable: ControllerStateSchema

> `const` **ControllerStateSchema**: `ZodObject`\<\{ `schemaVersion`: `ZodDefault`\<`ZodString`\>; `sessionId`: `ZodString`; `projectId`: `ZodString`; `currentPhase`: `ZodString`; `startedAt`: `ZodISODateTime`; `updatedAt`: `ZodISODateTime`; `queue`: `ZodObject`\<\{ `pending`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodString`\>\>\>; `inProgress`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodString`\>\>\>; `completed`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodString`\>\>\>; `blocked`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodString`\>\>\>; \}, `$strip`\>; `workers`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `id`: `ZodString`; `status`: `ZodEnum`\<\{ `error`: `"error"`; `idle`: `"idle"`; `working`: `"working"`; \}\>; `currentIssue`: `ZodNullable`\<`ZodString`\>; `startedAt`: `ZodNullable`\<`ZodISODateTime`\>; `completedTasks`: `ZodNumber`; \}, `$strip`\>\>\>\>; `totalIssues`: `ZodNumber`; `completedIssues`: `ZodDefault`\<`ZodOptional`\<`ZodNumber`\>\>; `failedIssues`: `ZodDefault`\<`ZodOptional`\<`ZodNumber`\>\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:379](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L379)
