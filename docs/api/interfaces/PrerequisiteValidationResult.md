[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PrerequisiteValidationResult

# Interface: PrerequisiteValidationResult

Defined in: [src/init/types.ts:129](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L129)

Overall validation result for prerequisites

## Properties

### checks

> `readonly` **checks**: readonly [`PrerequisiteResult`](PrerequisiteResult.md)[]

Defined in: [src/init/types.ts:131](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L131)

All prerequisite check results

***

### valid

> `readonly` **valid**: `boolean`

Defined in: [src/init/types.ts:134](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L134)

Whether all required checks passed

***

### warnings

> `readonly` **warnings**: `number`

Defined in: [src/init/types.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L137)

Number of warnings (optional checks that failed)
