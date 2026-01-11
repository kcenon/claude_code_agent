[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RequestSpec

# Interface: RequestSpec

Defined in: [src/component-generator/types.ts:102](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L102)

Request specification

## Properties

### headers

> `readonly` **headers**: readonly [`HeaderSpec`](HeaderSpec.md)[]

Defined in: [src/component-generator/types.ts:104](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L104)

Request headers

***

### pathParams

> `readonly` **pathParams**: readonly [`ParamSpec`](ParamSpec.md)[]

Defined in: [src/component-generator/types.ts:106](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L106)

Path parameters

***

### queryParams

> `readonly` **queryParams**: readonly [`ParamSpec`](ParamSpec.md)[]

Defined in: [src/component-generator/types.ts:108](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L108)

Query parameters

***

### body?

> `readonly` `optional` **body**: [`BodySchema`](BodySchema.md)

Defined in: [src/component-generator/types.ts:110](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L110)

Request body schema
