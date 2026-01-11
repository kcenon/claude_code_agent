[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TraceabilityEntry

# Interface: TraceabilityEntry

Defined in: [src/component-generator/types.ts:250](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L250)

Traceability entry mapping SF to CMP

## Properties

### featureId

> `readonly` **featureId**: `string`

Defined in: [src/component-generator/types.ts:252](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L252)

Feature ID (SF-XXX)

***

### featureName

> `readonly` **featureName**: `string`

Defined in: [src/component-generator/types.ts:254](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L254)

Feature name

***

### componentId

> `readonly` **componentId**: `string`

Defined in: [src/component-generator/types.ts:256](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L256)

Component ID (CMP-XXX)

***

### componentName

> `readonly` **componentName**: `string`

Defined in: [src/component-generator/types.ts:258](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L258)

Component name

***

### useCases

> `readonly` **useCases**: readonly [`UseCaseMapping`](UseCaseMapping.md)[]

Defined in: [src/component-generator/types.ts:260](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L260)

Associated use cases

***

### interfaces

> `readonly` **interfaces**: readonly `string`[]

Defined in: [src/component-generator/types.ts:262](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L262)

Associated interfaces
