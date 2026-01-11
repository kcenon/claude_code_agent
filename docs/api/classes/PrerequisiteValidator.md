[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PrerequisiteValidator

# Class: PrerequisiteValidator

Defined in: [src/init/PrerequisiteValidator.ts:17](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/PrerequisiteValidator.ts#L17)

Validates prerequisites required for AD-SDLC project initialization

## Constructors

### Constructor

> **new PrerequisiteValidator**(): `PrerequisiteValidator`

Defined in: [src/init/PrerequisiteValidator.ts:20](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/PrerequisiteValidator.ts#L20)

#### Returns

`PrerequisiteValidator`

## Methods

### validate()

> **validate**(): `Promise`\<[`PrerequisiteValidationResult`](../interfaces/PrerequisiteValidationResult.md)\>

Defined in: [src/init/PrerequisiteValidator.ts:52](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/PrerequisiteValidator.ts#L52)

Run all prerequisite checks

#### Returns

`Promise`\<[`PrerequisiteValidationResult`](../interfaces/PrerequisiteValidationResult.md)\>

***

### addCheck()

> **addCheck**(`check`): `void`

Defined in: [src/init/PrerequisiteValidator.ts:142](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/PrerequisiteValidator.ts#L142)

Add a custom prerequisite check

#### Parameters

##### check

[`PrerequisiteCheck`](../interfaces/PrerequisiteCheck.md)

#### Returns

`void`

***

### getChecks()

> **getChecks**(): readonly [`PrerequisiteCheck`](../interfaces/PrerequisiteCheck.md)[]

Defined in: [src/init/PrerequisiteValidator.ts:149](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/PrerequisiteValidator.ts#L149)

Get all registered checks

#### Returns

readonly [`PrerequisiteCheck`](../interfaces/PrerequisiteCheck.md)[]
