[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RateLimiters

# Variable: RateLimiters

> `const` **RateLimiters**: `object`

Defined in: [src/security/RateLimiter.ts:199](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/RateLimiter.ts#L199)

Pre-configured rate limiters for common use cases

## Type Declaration

### github()

> **github**: () => [`RateLimiter`](../classes/RateLimiter.md)

GitHub API rate limiter (5000 requests per hour for authenticated)

#### Returns

[`RateLimiter`](../classes/RateLimiter.md)

### claude()

> **claude**: () => [`RateLimiter`](../classes/RateLimiter.md)

Claude API rate limiter (moderate limit)

#### Returns

[`RateLimiter`](../classes/RateLimiter.md)

### strict()

> **strict**: () => [`RateLimiter`](../classes/RateLimiter.md)

Strict rate limiter for sensitive operations

#### Returns

[`RateLimiter`](../classes/RateLimiter.md)

### lenient()

> **lenient**: () => [`RateLimiter`](../classes/RateLimiter.md)

Lenient rate limiter for less sensitive operations

#### Returns

[`RateLimiter`](../classes/RateLimiter.md)
