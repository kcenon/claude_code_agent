[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / WorkOrderContextSchema

# Variable: WorkOrderContextSchema

> `const` **WorkOrderContextSchema**: `ZodObject`\<\{ `sdsComponent`: `ZodOptional`\<`ZodString`\>; `srsFeature`: `ZodOptional`\<`ZodString`\>; `prdRequirement`: `ZodOptional`\<`ZodString`\>; `relatedFiles`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `path`: `ZodString`; `reason`: `ZodString`; \}, `$strip`\>\>\>\>; `dependenciesStatus`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `issueId`: `ZodString`; `status`: `ZodEnum`\<\{ `closed`: `"closed"`; `open`: `"open"`; `in_progress`: `"in_progress"`; \}\>; \}, `$strip`\>\>\>\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:237](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L237)
