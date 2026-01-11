[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / assertPRReviewResult

# Function: assertPRReviewResult()

> **assertPRReviewResult**(`data`): `object`

Defined in: [src/scratchpad/validation.ts:274](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L274)

Assert that data is valid PRReviewResult

## Parameters

### data

`unknown`

Data to validate

## Returns

`object`

Validated data

### schemaVersion

> **schemaVersion**: `string`

### reviewId

> **reviewId**: `string`

### prNumber

> **prNumber**: `number`

### prUrl

> **prUrl**: `string`

### orderId

> **orderId**: `string`

### issueId

> **issueId**: `string`

### decision

> **decision**: `"approve"` \| `"request_changes"` \| `"reject"` = `ReviewDecisionSchema`

### comments

> **comments**: `object`[]

### qualityMetrics?

> `optional` **qualityMetrics**: `object`

#### qualityMetrics.testCoverage?

> `optional` **testCoverage**: `number`

#### qualityMetrics.lintErrors?

> `optional` **lintErrors**: `number`

#### qualityMetrics.lintWarnings?

> `optional` **lintWarnings**: `number`

#### qualityMetrics.securityIssues?

> `optional` **securityIssues**: `number`

#### qualityMetrics.complexity?

> `optional` **complexity**: `number`

### reviewedAt

> **reviewedAt**: `string`

### mergedAt?

> `optional` **mergedAt**: `string`

### reviewerNotes?

> `optional` **reviewerNotes**: `string`

## Throws

SchemaValidationError if validation fails
