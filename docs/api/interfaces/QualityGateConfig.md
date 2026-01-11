[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / QualityGateConfig

# Interface: QualityGateConfig

Defined in: [src/init/types.ts:163](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L163)

Quality gate configuration

## Properties

### coverage

> `readonly` **coverage**: `number`

Defined in: [src/init/types.ts:165](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L165)

Minimum test coverage percentage

***

### complexity

> `readonly` **complexity**: `number`

Defined in: [src/init/types.ts:168](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L168)

Maximum cyclomatic complexity

***

### requireReview

> `readonly` **requireReview**: `boolean`

Defined in: [src/init/types.ts:171](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L171)

Require PR reviews

***

### requireTests

> `readonly` **requireTests**: `boolean`

Defined in: [src/init/types.ts:174](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L174)

Require all tests to pass
