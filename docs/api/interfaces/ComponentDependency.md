[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComponentDependency

# Interface: ComponentDependency

Defined in: [src/component-generator/types.ts:280](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L280)

Component dependency specification

## Properties

### sourceId

> `readonly` **sourceId**: `string`

Defined in: [src/component-generator/types.ts:282](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L282)

Source component ID

***

### targetId

> `readonly` **targetId**: `string`

Defined in: [src/component-generator/types.ts:284](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L284)

Target component ID

***

### type

> `readonly` **type**: `"calls"` \| `"uses"` \| `"implements"` \| `"extends"`

Defined in: [src/component-generator/types.ts:286](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L286)

Dependency type

***

### description

> `readonly` **description**: `string`

Defined in: [src/component-generator/types.ts:288](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/types.ts#L288)

Dependency description
