[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InterfaceGenerator

# Class: InterfaceGenerator

Defined in: [src/component-generator/InterfaceGenerator.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/InterfaceGenerator.ts#L87)

Generates interface specifications from use cases

## Constructors

### Constructor

> **new InterfaceGenerator**(): `InterfaceGenerator`

Defined in: [src/component-generator/InterfaceGenerator.ts:90](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/InterfaceGenerator.ts#L90)

#### Returns

`InterfaceGenerator`

## Methods

### reset()

> **reset**(): `void`

Defined in: [src/component-generator/InterfaceGenerator.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/InterfaceGenerator.ts#L97)

Reset interface counters

#### Returns

`void`

***

### generateInterfaces()

> **generateInterfaces**(`useCases`): [`InterfaceSpec`](../interfaces/InterfaceSpec.md)[]

Defined in: [src/component-generator/InterfaceGenerator.ts:104](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/InterfaceGenerator.ts#L104)

Generate interfaces from use cases

#### Parameters

##### useCases

readonly [`SRSUseCase`](../interfaces/SRSUseCase.md)[]

#### Returns

[`InterfaceSpec`](../interfaces/InterfaceSpec.md)[]
