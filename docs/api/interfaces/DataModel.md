[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DataModel

# Interface: DataModel

Defined in: [src/sds-writer/types.ts:431](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L431)

Data model definition (for database design)

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/sds-writer/types.ts:433](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L433)

Model ID

***

### name

> `readonly` **name**: `string`

Defined in: [src/sds-writer/types.ts:435](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L435)

Model name

***

### category

> `readonly` **category**: [`DataTypeCategory`](../type-aliases/DataTypeCategory.md)

Defined in: [src/sds-writer/types.ts:437](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L437)

Category

***

### description

> `readonly` **description**: `string`

Defined in: [src/sds-writer/types.ts:439](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L439)

Description

***

### sourceComponent

> `readonly` **sourceComponent**: `string`

Defined in: [src/sds-writer/types.ts:441](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L441)

Source component ID

***

### properties

> `readonly` **properties**: readonly [`DataProperty`](DataProperty.md)[]

Defined in: [src/sds-writer/types.ts:443](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L443)

Properties/fields

***

### relationships

> `readonly` **relationships**: readonly [`DataRelationship`](DataRelationship.md)[]

Defined in: [src/sds-writer/types.ts:445](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L445)

Relationships to other models

***

### indexes?

> `readonly` `optional` **indexes**: readonly [`DataIndex`](DataIndex.md)[]

Defined in: [src/sds-writer/types.ts:447](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L447)

Indexes
