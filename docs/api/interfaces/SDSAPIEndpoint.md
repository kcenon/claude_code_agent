[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSAPIEndpoint

# Interface: SDSAPIEndpoint

Defined in: [src/sds-writer/types.ts:343](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L343)

API endpoint specification

## Properties

### path

> `readonly` **path**: `string`

Defined in: [src/sds-writer/types.ts:345](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L345)

Endpoint path (e.g., /api/v1/users)

***

### method

> `readonly` **method**: [`SDSHttpMethod`](../type-aliases/SDSHttpMethod.md)

Defined in: [src/sds-writer/types.ts:347](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L347)

HTTP method

***

### name

> `readonly` **name**: `string`

Defined in: [src/sds-writer/types.ts:349](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L349)

Endpoint name/summary

***

### description

> `readonly` **description**: `string`

Defined in: [src/sds-writer/types.ts:351](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L351)

Description

***

### sourceUseCase

> `readonly` **sourceUseCase**: `string`

Defined in: [src/sds-writer/types.ts:353](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L353)

Source use case ID

***

### sourceComponent

> `readonly` **sourceComponent**: `string`

Defined in: [src/sds-writer/types.ts:355](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L355)

Source component ID

***

### requestBody?

> `readonly` `optional` **requestBody**: [`DataSchema`](DataSchema.md)

Defined in: [src/sds-writer/types.ts:357](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L357)

Request body schema

***

### responseBody

> `readonly` **responseBody**: [`DataSchema`](DataSchema.md)

Defined in: [src/sds-writer/types.ts:359](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L359)

Response schema

***

### pathParameters?

> `readonly` `optional` **pathParameters**: readonly [`SDSAPIParameter`](SDSAPIParameter.md)[]

Defined in: [src/sds-writer/types.ts:361](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L361)

Path parameters

***

### queryParameters?

> `readonly` `optional` **queryParameters**: readonly [`SDSAPIParameter`](SDSAPIParameter.md)[]

Defined in: [src/sds-writer/types.ts:363](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L363)

Query parameters

***

### security

> `readonly` **security**: [`SecurityLevel`](../type-aliases/SecurityLevel.md)

Defined in: [src/sds-writer/types.ts:365](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L365)

Security requirements

***

### errorResponses

> `readonly` **errorResponses**: readonly [`SDSErrorResponse`](SDSErrorResponse.md)[]

Defined in: [src/sds-writer/types.ts:367](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L367)

Error responses
