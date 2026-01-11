[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComponentDesign

# Interface: ComponentDesign

Defined in: [src/component-generator/types.ts:294](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L294)

Complete component design result

## Properties

### components

> `readonly` **components**: readonly [`ComponentDefinition`](ComponentDefinition.md)[]

Defined in: [src/component-generator/types.ts:296](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L296)

Component definitions

***

### apiSpecification

> `readonly` **apiSpecification**: readonly [`APIEndpoint`](APIEndpoint.md)[]

Defined in: [src/component-generator/types.ts:298](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L298)

API specification table

***

### traceabilityMatrix

> `readonly` **traceabilityMatrix**: readonly [`TraceabilityEntry`](TraceabilityEntry.md)[]

Defined in: [src/component-generator/types.ts:300](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L300)

Traceability matrix

***

### dependencies

> `readonly` **dependencies**: readonly [`ComponentDependency`](ComponentDependency.md)[]

Defined in: [src/component-generator/types.ts:302](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L302)

Component dependencies

***

### metadata

> `readonly` **metadata**: [`ComponentDesignMetadata`](ComponentDesignMetadata.md)

Defined in: [src/component-generator/types.ts:304](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L304)

Design metadata
