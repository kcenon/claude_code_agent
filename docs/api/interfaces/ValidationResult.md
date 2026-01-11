[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ValidationResult

# Interface: ValidationResult

Defined in: [src/state-manager/types.ts:163](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L163)

Validation result for state operations

## Properties

### valid

> `readonly` **valid**: `boolean`

Defined in: [src/state-manager/types.ts:165](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L165)

Whether validation passed

***

### errors

> `readonly` **errors**: readonly [`StateValidationErrorDetail`](StateValidationErrorDetail.md)[]

Defined in: [src/state-manager/types.ts:167](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L167)

Validation errors
