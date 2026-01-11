[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GeneratedUseCase

# Interface: GeneratedUseCase

Defined in: [src/srs-writer/types.ts:240](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L240)

Generated use case with additional metadata

## Extends

- [`SRSUseCase`](SRSUseCase.md)

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/architecture-generator/types.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L67)

Use case identifier (e.g., UC-001)

#### Inherited from

[`SRSUseCase`](SRSUseCase.md).[`id`](SRSUseCase.md#id)

***

### name

> `readonly` **name**: `string`

Defined in: [src/architecture-generator/types.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L69)

Use case name

#### Inherited from

[`SRSUseCase`](SRSUseCase.md).[`name`](SRSUseCase.md#name)

***

### description

> `readonly` **description**: `string`

Defined in: [src/architecture-generator/types.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L71)

Use case description

#### Inherited from

[`SRSUseCase`](SRSUseCase.md).[`description`](SRSUseCase.md#description)

***

### actor

> `readonly` **actor**: `string`

Defined in: [src/architecture-generator/types.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L73)

Primary actor

#### Inherited from

[`SRSUseCase`](SRSUseCase.md).[`actor`](SRSUseCase.md#actor)

***

### preconditions

> `readonly` **preconditions**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L75)

Preconditions

#### Inherited from

[`SRSUseCase`](SRSUseCase.md).[`preconditions`](SRSUseCase.md#preconditions)

***

### mainFlow

> `readonly` **mainFlow**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L77)

Main flow steps

#### Inherited from

[`SRSUseCase`](SRSUseCase.md).[`mainFlow`](SRSUseCase.md#mainflow)

***

### alternativeFlows

> `readonly` **alternativeFlows**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:79](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L79)

Alternative flows

#### Inherited from

[`SRSUseCase`](SRSUseCase.md).[`alternativeFlows`](SRSUseCase.md#alternativeflows)

***

### postconditions

> `readonly` **postconditions**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:81](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L81)

Postconditions

#### Inherited from

[`SRSUseCase`](SRSUseCase.md).[`postconditions`](SRSUseCase.md#postconditions)

***

### sourceFeatureId

> `readonly` **sourceFeatureId**: `string`

Defined in: [src/srs-writer/types.ts:242](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L242)

Source feature ID

***

### sourceRequirementId

> `readonly` **sourceRequirementId**: `string`

Defined in: [src/srs-writer/types.ts:244](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L244)

Source requirement ID
