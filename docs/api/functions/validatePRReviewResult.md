[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / validatePRReviewResult

# Function: validatePRReviewResult()

> **validatePRReviewResult**(`data`): [`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `reviewId`: `string`; `prNumber`: `number`; `prUrl`: `string`; `orderId`: `string`; `issueId`: `string`; `decision`: `"approve"` \| `"request_changes"` \| `"reject"`; `comments`: `object`[]; `qualityMetrics?`: \{ `testCoverage?`: `number`; `lintErrors?`: `number`; `lintWarnings?`: `number`; `securityIssues?`: `number`; `complexity?`: `number`; \}; `reviewedAt`: `string`; `mergedAt?`: `string`; `reviewerNotes?`: `string`; \}\>

Defined in: [src/scratchpad/validation.ts:171](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L171)

Validate PRReviewResult data

## Parameters

### data

`unknown`

Data to validate

## Returns

[`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `reviewId`: `string`; `prNumber`: `number`; `prUrl`: `string`; `orderId`: `string`; `issueId`: `string`; `decision`: `"approve"` \| `"request_changes"` \| `"reject"`; `comments`: `object`[]; `qualityMetrics?`: \{ `testCoverage?`: `number`; `lintErrors?`: `number`; `lintWarnings?`: `number`; `securityIssues?`: `number`; `complexity?`: `number`; \}; `reviewedAt`: `string`; `mergedAt?`: `string`; `reviewerNotes?`: `string`; \}\>

Validation result
