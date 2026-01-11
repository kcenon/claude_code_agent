[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DataRelationship

# Interface: DataRelationship

Defined in: [src/sds-writer/types.ts:453](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L453)

Relationship between data models

## Properties

### target

> `readonly` **target**: `string`

Defined in: [src/sds-writer/types.ts:455](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L455)

Target model name

***

### type

> `readonly` **type**: `"one-to-one"` \| `"one-to-many"` \| `"many-to-many"`

Defined in: [src/sds-writer/types.ts:457](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L457)

Relationship type

***

### foreignKey?

> `readonly` `optional` **foreignKey**: `string`

Defined in: [src/sds-writer/types.ts:459](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L459)

Foreign key field (if applicable)

***

### description?

> `readonly` `optional` **description**: `string`

Defined in: [src/sds-writer/types.ts:461](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L461)

Description
