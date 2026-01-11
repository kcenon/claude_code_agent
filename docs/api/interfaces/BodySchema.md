[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / BodySchema

# Interface: BodySchema

Defined in: [src/component-generator/types.ts:182](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L182)

Body schema specification

## Properties

### contentType

> `readonly` **contentType**: `string`

Defined in: [src/component-generator/types.ts:184](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L184)

Content type

***

### fields

> `readonly` **fields**: readonly [`FieldSpec`](FieldSpec.md)[]

Defined in: [src/component-generator/types.ts:186](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L186)

Schema fields

***

### example?

> `readonly` `optional` **example**: `Record`\<`string`, `unknown`\>

Defined in: [src/component-generator/types.ts:188](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L188)

Example value
