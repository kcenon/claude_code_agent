[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FieldSpec

# Interface: FieldSpec

Defined in: [src/component-generator/types.ts:194](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L194)

Field specification

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/component-generator/types.ts:196](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L196)

Field name

***

### type

> `readonly` **type**: [`DataType`](../type-aliases/DataType.md)

Defined in: [src/component-generator/types.ts:198](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L198)

Field type

***

### description

> `readonly` **description**: `string`

Defined in: [src/component-generator/types.ts:200](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L200)

Field description

***

### required

> `readonly` **required**: `boolean`

Defined in: [src/component-generator/types.ts:202](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L202)

Is required

***

### fields?

> `readonly` `optional` **fields**: readonly `FieldSpec`[]

Defined in: [src/component-generator/types.ts:204](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L204)

Nested fields (for object type)

***

### items?

> `readonly` `optional` **items**: [`DataType`](../type-aliases/DataType.md) \| readonly `FieldSpec`[]

Defined in: [src/component-generator/types.ts:206](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L206)

Array item type (for array type)
