[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DataDesignerOptions

# Interface: DataDesignerOptions

Defined in: [src/sds-writer/DataDesigner.ts:22](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L22)

Data designer options

## Properties

### defaultCategory?

> `readonly` `optional` **defaultCategory**: [`DataTypeCategory`](../type-aliases/DataTypeCategory.md)

Defined in: [src/sds-writer/DataDesigner.ts:24](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L24)

Default category for data models

***

### generateIndexes?

> `readonly` `optional` **generateIndexes**: `boolean`

Defined in: [src/sds-writer/DataDesigner.ts:26](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L26)

Generate indexes automatically

***

### includeTimestamps?

> `readonly` `optional` **includeTimestamps**: `boolean`

Defined in: [src/sds-writer/DataDesigner.ts:28](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L28)

Include timestamps (createdAt, updatedAt)

***

### includeSoftDelete?

> `readonly` `optional` **includeSoftDelete**: `boolean`

Defined in: [src/sds-writer/DataDesigner.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L30)

Include soft delete (deletedAt)
