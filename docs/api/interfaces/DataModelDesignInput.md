[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DataModelDesignInput

# Interface: DataModelDesignInput

Defined in: [src/sds-writer/types.ts:773](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L773)

Data model design input (for DataDesigner)

## Properties

### component

> `readonly` **component**: [`SDSComponent`](SDSComponent.md)

Defined in: [src/sds-writer/types.ts:775](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L775)

Component this data model belongs to

***

### features

> `readonly` **features**: readonly [`ParsedSRSFeature`](ParsedSRSFeature.md)[]

Defined in: [src/sds-writer/types.ts:777](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L777)

Related features

***

### modelIndex

> `readonly` **modelIndex**: `number`

Defined in: [src/sds-writer/types.ts:779](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L779)

Model index for ID generation
