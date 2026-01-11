[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSGenerationResult

# Interface: SRSGenerationResult

Defined in: [src/srs-writer/types.ts:344](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L344)

SRS generation result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/srs-writer/types.ts:346](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L346)

Whether generation was successful

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/srs-writer/types.ts:348](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L348)

Project ID

***

### scratchpadPath

> `readonly` **scratchpadPath**: `string`

Defined in: [src/srs-writer/types.ts:350](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L350)

Path to the generated SRS in scratchpad

***

### publicPath

> `readonly` **publicPath**: `string`

Defined in: [src/srs-writer/types.ts:352](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L352)

Path to the public SRS document

***

### generatedSRS

> `readonly` **generatedSRS**: [`SRSWriterGeneratedSRS`](SRSWriterGeneratedSRS.md)

Defined in: [src/srs-writer/types.ts:354](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L354)

Generated SRS content

***

### stats

> `readonly` **stats**: [`SRSGenerationStats`](SRSGenerationStats.md)

Defined in: [src/srs-writer/types.ts:356](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L356)

Generation statistics
