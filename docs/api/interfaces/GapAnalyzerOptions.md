[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GapAnalyzerOptions

# Interface: GapAnalyzerOptions

Defined in: [src/prd-writer/GapAnalyzer.ts:16](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/GapAnalyzer.ts#L16)

Configuration for gap analysis

## Properties

### minFunctionalRequirements?

> `readonly` `optional` **minFunctionalRequirements**: `number`

Defined in: [src/prd-writer/GapAnalyzer.ts:18](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/GapAnalyzer.ts#L18)

Minimum number of functional requirements expected

***

### minAcceptanceCriteria?

> `readonly` `optional` **minAcceptanceCriteria**: `number`

Defined in: [src/prd-writer/GapAnalyzer.ts:20](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/GapAnalyzer.ts#L20)

Minimum number of acceptance criteria per requirement

***

### requireUserStories?

> `readonly` `optional` **requireUserStories**: `boolean`

Defined in: [src/prd-writer/GapAnalyzer.ts:22](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/GapAnalyzer.ts#L22)

Whether to check for user stories

***

### requireNFRMetrics?

> `readonly` `optional` **requireNFRMetrics**: `boolean`

Defined in: [src/prd-writer/GapAnalyzer.ts:24](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/GapAnalyzer.ts#L24)

Whether to check for metrics in NFRs
