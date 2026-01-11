[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ControllerDependencyEdge

# Interface: ControllerDependencyEdge

Defined in: [src/controller/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L65)

Dependency edge in the graph

## Properties

### from

> `readonly` **from**: `string`

Defined in: [src/controller/types.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L67)

Source issue ID (the issue that depends on another)

***

### to

> `readonly` **to**: `string`

Defined in: [src/controller/types.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L69)

Target issue ID (the issue being depended on)
