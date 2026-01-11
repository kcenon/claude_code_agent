[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSTemplateProcessingResult

# Interface: SRSTemplateProcessingResult

Defined in: [src/srs-writer/types.ts:394](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L394)

Template processing result

## Properties

### content

> `readonly` **content**: `string`

Defined in: [src/srs-writer/types.ts:396](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L396)

Processed content

***

### substitutedVariables

> `readonly` **substitutedVariables**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:398](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L398)

Variables that were substituted

***

### missingVariables

> `readonly` **missingVariables**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:400](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L400)

Variables that were missing

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:402](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L402)

Warnings during processing
