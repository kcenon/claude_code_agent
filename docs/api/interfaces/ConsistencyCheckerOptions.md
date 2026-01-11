[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ConsistencyCheckerOptions

# Interface: ConsistencyCheckerOptions

Defined in: [src/prd-writer/ConsistencyChecker.ts:23](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/ConsistencyChecker.ts#L23)

Configuration for consistency checking

## Properties

### maxP0Percentage?

> `readonly` `optional` **maxP0Percentage**: `number`

Defined in: [src/prd-writer/ConsistencyChecker.ts:25](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/ConsistencyChecker.ts#L25)

Maximum percentage of P0 requirements allowed

***

### minLowPriorityPercentage?

> `readonly` `optional` **minLowPriorityPercentage**: `number`

Defined in: [src/prd-writer/ConsistencyChecker.ts:27](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/ConsistencyChecker.ts#L27)

Minimum percentage of P2/P3 requirements expected

***

### checkBidirectionalDeps?

> `readonly` `optional` **checkBidirectionalDeps**: `boolean`

Defined in: [src/prd-writer/ConsistencyChecker.ts:29](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/ConsistencyChecker.ts#L29)

Whether to check for bidirectional dependencies

***

### duplicateSimilarityThreshold?

> `readonly` `optional` **duplicateSimilarityThreshold**: `number`

Defined in: [src/prd-writer/ConsistencyChecker.ts:31](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/ConsistencyChecker.ts#L31)

Similarity threshold for duplicate detection (0.0 - 1.0)
