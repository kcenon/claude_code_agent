[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FunctionalRequirementSchema

# Variable: FunctionalRequirementSchema

> `const` **FunctionalRequirementSchema**: `ZodObject`\<\{ `id`: `ZodString`; `title`: `ZodString`; `description`: `ZodString`; `priority`: `ZodEnum`\<\{ `P0`: `"P0"`; `P1`: `"P1"`; `P2`: `"P2"`; `P3`: `"P3"`; \}\>; `status`: `ZodDefault`\<`ZodOptional`\<`ZodEnum`\<\{ `rejected`: `"rejected"`; `proposed`: `"proposed"`; `approved`: `"approved"`; `implemented`: `"implemented"`; \}\>\>\>; `acceptanceCriteria`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `id`: `ZodString`; `description`: `ZodString`; `testable`: `ZodDefault`\<`ZodBoolean`\>; \}, `$strip`\>\>\>\>; `dependencies`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodString`\>\>\>; `source`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L89)
