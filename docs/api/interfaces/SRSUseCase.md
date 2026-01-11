[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSUseCase

# Interface: SRSUseCase

Defined in: [src/architecture-generator/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L65)

SRS use case definition

## Extended by

- [`GeneratedUseCase`](GeneratedUseCase.md)

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/architecture-generator/types.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L67)

Use case identifier (e.g., UC-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/architecture-generator/types.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L69)

Use case name

***

### description

> `readonly` **description**: `string`

Defined in: [src/architecture-generator/types.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L71)

Use case description

***

### actor

> `readonly` **actor**: `string`

Defined in: [src/architecture-generator/types.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L73)

Primary actor

***

### preconditions

> `readonly` **preconditions**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L75)

Preconditions

***

### mainFlow

> `readonly` **mainFlow**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L77)

Main flow steps

***

### alternativeFlows

> `readonly` **alternativeFlows**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:79](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L79)

Alternative flows

***

### postconditions

> `readonly` **postconditions**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:81](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L81)

Postconditions
