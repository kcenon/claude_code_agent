[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DeploymentSpec

# Interface: DeploymentSpec

Defined in: [src/sds-writer/types.ts:555](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L555)

Deployment architecture

## Properties

### pattern

> `readonly` **pattern**: `"microservices"` \| `"monolith"` \| `"serverless"` \| `"hybrid"`

Defined in: [src/sds-writer/types.ts:557](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L557)

Deployment pattern

***

### environments

> `readonly` **environments**: readonly [`EnvironmentSpec`](EnvironmentSpec.md)[]

Defined in: [src/sds-writer/types.ts:559](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L559)

Environment specifications

***

### scaling?

> `readonly` `optional` **scaling**: [`ScalingSpec`](ScalingSpec.md)

Defined in: [src/sds-writer/types.ts:561](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L561)

Scaling strategy
