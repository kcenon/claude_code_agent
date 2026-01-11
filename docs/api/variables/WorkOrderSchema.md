[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / WorkOrderSchema

# Variable: WorkOrderSchema

> `const` **WorkOrderSchema**: `ZodObject`\<\{ `schemaVersion`: `ZodDefault`\<`ZodString`\>; `orderId`: `ZodString`; `issueId`: `ZodString`; `issueUrl`: `ZodURL`; `createdAt`: `ZodISODateTime`; `priority`: `ZodNumber`; `context`: `ZodObject`\<\{ `sdsComponent`: `ZodOptional`\<`ZodString`\>; `srsFeature`: `ZodOptional`\<`ZodString`\>; `prdRequirement`: `ZodOptional`\<`ZodString`\>; `relatedFiles`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `path`: `ZodString`; `reason`: `ZodString`; \}, `$strip`\>\>\>\>; `dependenciesStatus`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `issueId`: `ZodString`; `status`: `ZodEnum`\<\{ `closed`: ...; `open`: ...; `in_progress`: ...; \}\>; \}, `$strip`\>\>\>\>; \}, `$strip`\>; `acceptanceCriteria`: `ZodArray`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:250](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L250)
