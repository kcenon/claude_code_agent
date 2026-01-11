[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRDTemplateProcessingResult

# Interface: PRDTemplateProcessingResult

Defined in: [src/prd-writer/types.ts:301](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L301)

Template processing result

## Properties

### content

> `readonly` **content**: `string`

Defined in: [src/prd-writer/types.ts:303](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L303)

Processed content

***

### substitutedVariables

> `readonly` **substitutedVariables**: readonly `string`[]

Defined in: [src/prd-writer/types.ts:305](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L305)

Variables that were substituted

***

### missingVariables

> `readonly` **missingVariables**: readonly `string`[]

Defined in: [src/prd-writer/types.ts:307](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L307)

Variables that were missing

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/prd-writer/types.ts:309](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L309)

Warnings during processing
