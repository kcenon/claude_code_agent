[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RateLimiter

# Class: RateLimiter

Defined in: [src/security/RateLimiter.ts:32](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L32)

Simple rate limiter using sliding window algorithm

## Constructors

### Constructor

> **new RateLimiter**(`config`): `RateLimiter`

Defined in: [src/security/RateLimiter.ts:37](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L37)

#### Parameters

##### config

`Partial`\<[`RateLimitConfig`](../interfaces/RateLimitConfig.md)\> = `{}`

#### Returns

`RateLimiter`

## Methods

### stop()

> **stop**(): `void`

Defined in: [src/security/RateLimiter.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L63)

Stop the cleanup interval

#### Returns

`void`

***

### check()

> **check**(`key`): [`RateLimitStatus`](../interfaces/RateLimitStatus.md)

Defined in: [src/security/RateLimiter.ts:90](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L90)

Check if a request is allowed and consume a token

#### Parameters

##### key

`string`

The rate limit key (e.g., API key, IP address)

#### Returns

[`RateLimitStatus`](../interfaces/RateLimitStatus.md)

Rate limit status

***

### checkOrThrow()

> **checkOrThrow**(`key`): [`RateLimitStatus`](../interfaces/RateLimitStatus.md)

Defined in: [src/security/RateLimiter.ts:127](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L127)

Check rate limit and throw if exceeded

#### Parameters

##### key

`string`

The rate limit key

#### Returns

[`RateLimitStatus`](../interfaces/RateLimitStatus.md)

#### Throws

RateLimitExceededError if limit exceeded

***

### getStatus()

> **getStatus**(`key`): [`RateLimitStatus`](../interfaces/RateLimitStatus.md)

Defined in: [src/security/RateLimiter.ts:143](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L143)

Get current status without consuming a token

#### Parameters

##### key

`string`

The rate limit key

#### Returns

[`RateLimitStatus`](../interfaces/RateLimitStatus.md)

Current rate limit status

***

### reset()

> **reset**(`key`): `void`

Defined in: [src/security/RateLimiter.ts:170](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L170)

Reset the rate limit for a key

#### Parameters

##### key

`string`

The rate limit key to reset

#### Returns

`void`

***

### resetAll()

> **resetAll**(): `void`

Defined in: [src/security/RateLimiter.ts:177](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L177)

Reset all rate limits

#### Returns

`void`

***

### getConfig()

> **getConfig**(): [`RateLimitConfig`](../interfaces/RateLimitConfig.md)

Defined in: [src/security/RateLimiter.ts:184](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L184)

Get the configuration

#### Returns

[`RateLimitConfig`](../interfaces/RateLimitConfig.md)

***

### getTrackedCount()

> **getTrackedCount**(): `number`

Defined in: [src/security/RateLimiter.ts:191](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L191)

Get the number of tracked keys

#### Returns

`number`
