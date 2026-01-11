[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / COMMON\_HEADERS

# Variable: COMMON\_HEADERS

> `const` **COMMON\_HEADERS**: `object`

Defined in: [src/component-generator/schemas.ts:114](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/schemas.ts#L114)

Common request headers

## Type Declaration

### AUTHORIZATION

> `readonly` **AUTHORIZATION**: `object`

#### AUTHORIZATION.name

> `readonly` **name**: `"Authorization"` = `'Authorization'`

#### AUTHORIZATION.description

> `readonly` **description**: `"Bearer token for authentication"` = `'Bearer token for authentication'`

#### AUTHORIZATION.required

> `readonly` **required**: `true` = `true`

#### AUTHORIZATION.example

> `readonly` **example**: `"Bearer {token}"` = `'Bearer {token}'`

### CONTENT\_TYPE

> `readonly` **CONTENT\_TYPE**: `object`

#### CONTENT\_TYPE.name

> `readonly` **name**: `"Content-Type"` = `'Content-Type'`

#### CONTENT\_TYPE.description

> `readonly` **description**: `"Request body content type"` = `'Request body content type'`

#### CONTENT\_TYPE.required

> `readonly` **required**: `true` = `true`

#### CONTENT\_TYPE.example

> `readonly` **example**: `"application/json"` = `'application/json'`

### ACCEPT

> `readonly` **ACCEPT**: `object`

#### ACCEPT.name

> `readonly` **name**: `"Accept"` = `'Accept'`

#### ACCEPT.description

> `readonly` **description**: `"Expected response content type"` = `'Expected response content type'`

#### ACCEPT.required

> `readonly` **required**: `false` = `false`

#### ACCEPT.example

> `readonly` **example**: `"application/json"` = `'application/json'`

### CORRELATION\_ID

> `readonly` **CORRELATION\_ID**: `object`

#### CORRELATION\_ID.name

> `readonly` **name**: `"X-Correlation-ID"` = `'X-Correlation-ID'`

#### CORRELATION\_ID.description

> `readonly` **description**: `"Request correlation identifier for tracing"` = `'Request correlation identifier for tracing'`

#### CORRELATION\_ID.required

> `readonly` **required**: `false` = `false`

#### CORRELATION\_ID.example

> `readonly` **example**: `"uuid-v4"` = `'uuid-v4'`
