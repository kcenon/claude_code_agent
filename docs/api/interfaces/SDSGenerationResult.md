[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSGenerationResult

# Interface: SDSGenerationResult

Defined in: [src/sds-writer/types.ts:705](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L705)

SDS generation result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/sds-writer/types.ts:707](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L707)

Whether generation was successful

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/sds-writer/types.ts:709](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L709)

Project ID

***

### scratchpadPath

> `readonly` **scratchpadPath**: `string`

Defined in: [src/sds-writer/types.ts:711](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L711)

Path to the generated SDS in scratchpad

***

### publicPath

> `readonly` **publicPath**: `string`

Defined in: [src/sds-writer/types.ts:713](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L713)

Path to the public SDS document

***

### generatedSDS

> `readonly` **generatedSDS**: [`GeneratedSDS`](GeneratedSDS.md)

Defined in: [src/sds-writer/types.ts:715](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L715)

Generated SDS content

***

### stats

> `readonly` **stats**: [`SDSGenerationStats`](SDSGenerationStats.md)

Defined in: [src/sds-writer/types.ts:717](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L717)

Generation statistics
