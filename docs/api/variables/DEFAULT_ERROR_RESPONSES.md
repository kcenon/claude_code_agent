[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DEFAULT\_ERROR\_RESPONSES

# Variable: DEFAULT\_ERROR\_RESPONSES

> `const` **DEFAULT\_ERROR\_RESPONSES**: `object`

Defined in: [src/component-generator/schemas.ts:92](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/schemas.ts#L92)

Default error responses for common status codes

## Type Declaration

### 400

> `readonly` **400**: `object`

#### 400.status

> `readonly` **status**: `400` = `400`

#### 400.message

> `readonly` **message**: `"Invalid input"` = `'Invalid input'`

#### 400.code

> `readonly` **code**: `"INVALID_INPUT"` = `'INVALID_INPUT'`

### 401

> `readonly` **401**: `object`

#### 401.status

> `readonly` **status**: `401` = `401`

#### 401.message

> `readonly` **message**: `"Authentication required"` = `'Authentication required'`

#### 401.code

> `readonly` **code**: `"UNAUTHORIZED"` = `'UNAUTHORIZED'`

### 403

> `readonly` **403**: `object`

#### 403.status

> `readonly` **status**: `403` = `403`

#### 403.message

> `readonly` **message**: `"Access forbidden"` = `'Access forbidden'`

#### 403.code

> `readonly` **code**: `"FORBIDDEN"` = `'FORBIDDEN'`

### 404

> `readonly` **404**: `object`

#### 404.status

> `readonly` **status**: `404` = `404`

#### 404.message

> `readonly` **message**: `"Resource not found"` = `'Resource not found'`

#### 404.code

> `readonly` **code**: `"NOT_FOUND"` = `'NOT_FOUND'`

### 409

> `readonly` **409**: `object`

#### 409.status

> `readonly` **status**: `409` = `409`

#### 409.message

> `readonly` **message**: `"Resource conflict"` = `'Resource conflict'`

#### 409.code

> `readonly` **code**: `"CONFLICT"` = `'CONFLICT'`

### 422

> `readonly` **422**: `object`

#### 422.status

> `readonly` **status**: `422` = `422`

#### 422.message

> `readonly` **message**: `"Validation error"` = `'Validation error'`

#### 422.code

> `readonly` **code**: `"VALIDATION_ERROR"` = `'VALIDATION_ERROR'`

### 429

> `readonly` **429**: `object`

#### 429.status

> `readonly` **status**: `429` = `429`

#### 429.message

> `readonly` **message**: `"Rate limit exceeded"` = `'Rate limit exceeded'`

#### 429.code

> `readonly` **code**: `"RATE_LIMIT_EXCEEDED"` = `'RATE_LIMIT_EXCEEDED'`

### 500

> `readonly` **500**: `object`

#### 500.status

> `readonly` **status**: `500` = `500`

#### 500.message

> `readonly` **message**: `"Internal server error"` = `'Internal server error'`

#### 500.code

> `readonly` **code**: `"INTERNAL_ERROR"` = `'INTERNAL_ERROR'`
