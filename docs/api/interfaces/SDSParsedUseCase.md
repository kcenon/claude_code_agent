[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSParsedUseCase

# Interface: SDSParsedUseCase

Defined in: [src/sds-writer/types.ts:150](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L150)

Parsed use case from SRS

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/sds-writer/types.ts:152](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L152)

Use case ID (e.g., UC-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/sds-writer/types.ts:154](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L154)

Use case name

***

### primaryActor

> `readonly` **primaryActor**: `string`

Defined in: [src/sds-writer/types.ts:156](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L156)

Primary actor

***

### preconditions

> `readonly` **preconditions**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:158](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L158)

Preconditions

***

### mainScenario

> `readonly` **mainScenario**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:160](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L160)

Main success scenario (steps)

***

### alternativeScenarios

> `readonly` **alternativeScenarios**: readonly [`AlternativeScenario`](AlternativeScenario.md)[]

Defined in: [src/sds-writer/types.ts:162](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L162)

Alternative scenarios

***

### postconditions

> `readonly` **postconditions**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:164](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L164)

Postconditions

***

### sourceFeatureId

> `readonly` **sourceFeatureId**: `string`

Defined in: [src/sds-writer/types.ts:166](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L166)

Source feature ID
