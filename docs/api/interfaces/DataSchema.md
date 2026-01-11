[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DataSchema

# Interface: DataSchema

Defined in: [src/sds-writer/types.ts:399](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L399)

Data schema definition

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/sds-writer/types.ts:401](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L401)

Schema name

***

### type

> `readonly` **type**: `"object"` \| `"array"` \| `"primitive"`

Defined in: [src/sds-writer/types.ts:403](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L403)

Schema type

***

### properties?

> `readonly` `optional` **properties**: readonly [`DataProperty`](DataProperty.md)[]

Defined in: [src/sds-writer/types.ts:405](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L405)

Properties (for object type)

***

### itemType?

> `readonly` `optional` **itemType**: `string`

Defined in: [src/sds-writer/types.ts:407](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L407)

Array item type (for array type)

***

### primitiveType?

> `readonly` `optional` **primitiveType**: `string`

Defined in: [src/sds-writer/types.ts:409](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L409)

Primitive type (for primitive type)
