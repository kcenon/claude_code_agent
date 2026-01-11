[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComponentConnection

# Interface: ComponentConnection

Defined in: [src/architecture-generator/types.ts:278](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L278)

Connection between components

## Properties

### targetId

> `readonly` **targetId**: `string`

Defined in: [src/architecture-generator/types.ts:280](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L280)

Target component ID

***

### label

> `readonly` **label**: `string`

Defined in: [src/architecture-generator/types.ts:282](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L282)

Connection label

***

### type

> `readonly` **type**: `"data"` \| `"sync"` \| `"async"` \| `"event"`

Defined in: [src/architecture-generator/types.ts:284](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L284)

Connection type
