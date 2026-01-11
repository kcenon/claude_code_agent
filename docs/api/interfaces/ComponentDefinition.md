[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComponentDefinition

# Interface: ComponentDefinition

Defined in: [src/component-generator/types.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L46)

Component definition following SDS-001 template

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/component-generator/types.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L48)

Component identifier (CMP-XXX)

***

### name

> `readonly` **name**: `string`

Defined in: [src/component-generator/types.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L50)

Component name

***

### responsibility

> `readonly` **responsibility**: `string`

Defined in: [src/component-generator/types.ts:52](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L52)

Component responsibility description

***

### sourceFeature

> `readonly` **sourceFeature**: `string`

Defined in: [src/component-generator/types.ts:54](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L54)

Source feature ID (SF-XXX)

***

### interfaces

> `readonly` **interfaces**: readonly [`InterfaceSpec`](InterfaceSpec.md)[]

Defined in: [src/component-generator/types.ts:56](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L56)

Interface specifications

***

### dependencies

> `readonly` **dependencies**: readonly `string`[]

Defined in: [src/component-generator/types.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L58)

Component dependencies

***

### implementationNotes

> `readonly` **implementationNotes**: `string`

Defined in: [src/component-generator/types.ts:60](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L60)

Implementation notes

***

### layer

> `readonly` **layer**: [`ComponentLayer`](../type-aliases/ComponentLayer.md)

Defined in: [src/component-generator/types.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L62)

Component layer
