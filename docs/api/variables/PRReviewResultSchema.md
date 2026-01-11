[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRReviewResultSchema

# Variable: PRReviewResultSchema

> `const` **PRReviewResultSchema**: `ZodObject`\<\{ `schemaVersion`: `ZodDefault`\<`ZodString`\>; `reviewId`: `ZodString`; `prNumber`: `ZodNumber`; `prUrl`: `ZodURL`; `orderId`: `ZodString`; `issueId`: `ZodString`; `decision`: `ZodEnum`\<\{ `approve`: `"approve"`; `request_changes`: `"request_changes"`; `reject`: `"reject"`; \}\>; `comments`: `ZodDefault`\<`ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `filePath`: `ZodString`; `line`: `ZodNumber`; `severity`: `ZodEnum`\<\{ `info`: `"info"`; `warning`: `"warning"`; `error`: `"error"`; `suggestion`: `"suggestion"`; \}\>; `message`: `ZodString`; `category`: `ZodOptional`\<`ZodEnum`\<\{ `test`: `"test"`; `style`: `"style"`; `security`: `"security"`; `performance`: `"performance"`; `logic`: `"logic"`; \}\>\>; \}, `$strip`\>\>\>\>; `qualityMetrics`: `ZodOptional`\<`ZodObject`\<\{ `testCoverage`: `ZodOptional`\<`ZodNumber`\>; `lintErrors`: `ZodOptional`\<`ZodNumber`\>; `lintWarnings`: `ZodOptional`\<`ZodNumber`\>; `securityIssues`: `ZodOptional`\<`ZodNumber`\>; `complexity`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>\>; `reviewedAt`: `ZodISODateTime`; `mergedAt`: `ZodOptional`\<`ZodISODateTime`\>; `reviewerNotes`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/scratchpad/schemas.ts:334](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/schemas.ts#L334)
