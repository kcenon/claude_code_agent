[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSFeature

# Interface: SRSFeature

Defined in: [src/architecture-generator/types.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L47)

SRS system feature extracted from document

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/architecture-generator/types.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L49)

Feature identifier (e.g., SF-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/architecture-generator/types.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L51)

Feature name

***

### description

> `readonly` **description**: `string`

Defined in: [src/architecture-generator/types.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L53)

Feature description

***

### priority

> `readonly` **priority**: `"P0"` \| `"P1"` \| `"P2"` \| `"P3"`

Defined in: [src/architecture-generator/types.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L55)

Priority level

***

### useCases

> `readonly` **useCases**: readonly [`SRSUseCase`](SRSUseCase.md)[]

Defined in: [src/architecture-generator/types.ts:57](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L57)

Use cases associated with this feature

***

### nfrs

> `readonly` **nfrs**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L59)

Non-functional requirements
