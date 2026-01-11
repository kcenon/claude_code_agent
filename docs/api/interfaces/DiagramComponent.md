[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DiagramComponent

# Interface: DiagramComponent

Defined in: [src/architecture-generator/types.ts:262](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L262)

Component definition for diagrams

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/architecture-generator/types.ts:264](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L264)

Component ID

***

### name

> `readonly` **name**: `string`

Defined in: [src/architecture-generator/types.ts:266](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L266)

Component name

***

### layer

> `readonly` **layer**: `string`

Defined in: [src/architecture-generator/types.ts:268](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L268)

Component layer

***

### type

> `readonly` **type**: `"repository"` \| `"controller"` \| `"external"` \| `"service"` \| `"utility"`

Defined in: [src/architecture-generator/types.ts:270](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L270)

Component type

***

### connections

> `readonly` **connections**: readonly [`ComponentConnection`](ComponentConnection.md)[]

Defined in: [src/architecture-generator/types.ts:272](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L272)

Connections to other components
