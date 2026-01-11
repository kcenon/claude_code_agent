[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRDWriterAgentConfig

# Interface: PRDWriterAgentConfig

Defined in: [src/prd-writer/types.ts:201](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L201)

PRD Writer Agent configuration options

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/prd-writer/types.ts:203](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L203)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### templatePath?

> `readonly` `optional` **templatePath**: `string`

Defined in: [src/prd-writer/types.ts:205](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L205)

Path to PRD template (defaults to .ad-sdlc/templates/prd-template.md)

***

### failOnCriticalGaps?

> `readonly` `optional` **failOnCriticalGaps**: `boolean`

Defined in: [src/prd-writer/types.ts:207](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L207)

Whether to fail on critical gaps

***

### autoSuggestPriorities?

> `readonly` `optional` **autoSuggestPriorities**: `boolean`

Defined in: [src/prd-writer/types.ts:209](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L209)

Whether to auto-suggest priorities

***

### publicDocsPath?

> `readonly` `optional` **publicDocsPath**: `string`

Defined in: [src/prd-writer/types.ts:211](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L211)

Output directory for public PRD docs

***

### includeGapAnalysis?

> `readonly` `optional` **includeGapAnalysis**: `boolean`

Defined in: [src/prd-writer/types.ts:213](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L213)

Whether to include gap analysis in output
