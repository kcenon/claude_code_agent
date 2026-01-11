[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RateLimitStatus

# Interface: RateLimitStatus

Defined in: [src/security/types.ts:132](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L132)

Rate limit status

## Properties

### allowed

> `readonly` **allowed**: `boolean`

Defined in: [src/security/types.ts:134](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L134)

Whether request is allowed

***

### remaining

> `readonly` **remaining**: `number`

Defined in: [src/security/types.ts:136](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L136)

Remaining requests in current window

***

### resetIn

> `readonly` **resetIn**: `number`

Defined in: [src/security/types.ts:138](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L138)

Time until rate limit resets (ms)
