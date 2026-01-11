[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / APIEndpoint

# Interface: APIEndpoint

Defined in: [src/component-generator/types.ts:82](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L82)

API endpoint specification

## Properties

### endpoint

> `readonly` **endpoint**: `string`

Defined in: [src/component-generator/types.ts:84](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L84)

Endpoint path

***

### method

> `readonly` **method**: [`HttpMethod`](../type-aliases/HttpMethod.md)

Defined in: [src/component-generator/types.ts:86](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L86)

HTTP method

***

### description

> `readonly` **description**: `string`

Defined in: [src/component-generator/types.ts:88](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L88)

Endpoint description

***

### request

> `readonly` **request**: [`RequestSpec`](RequestSpec.md)

Defined in: [src/component-generator/types.ts:90](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L90)

Request specification

***

### response

> `readonly` **response**: [`ResponseSpec`](ResponseSpec.md)

Defined in: [src/component-generator/types.ts:92](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L92)

Response specifications

***

### authenticated

> `readonly` **authenticated**: `boolean`

Defined in: [src/component-generator/types.ts:94](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L94)

Authentication required

***

### rateLimit?

> `readonly` `optional` **rateLimit**: [`RateLimitSpec`](RateLimitSpec.md)

Defined in: [src/component-generator/types.ts:96](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L96)

Rate limiting configuration
