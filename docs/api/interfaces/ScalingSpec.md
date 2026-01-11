[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ScalingSpec

# Interface: ScalingSpec

Defined in: [src/sds-writer/types.ts:579](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L579)

Scaling specification

## Properties

### type

> `readonly` **type**: `"auto"` \| `"horizontal"` \| `"vertical"`

Defined in: [src/sds-writer/types.ts:581](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L581)

Scaling type

***

### metrics?

> `readonly` `optional` **metrics**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:583](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L583)

Metrics for auto-scaling

***

### minInstances?

> `readonly` `optional` **minInstances**: `number`

Defined in: [src/sds-writer/types.ts:585](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L585)

Min instances

***

### maxInstances?

> `readonly` `optional` **maxInstances**: `number`

Defined in: [src/sds-writer/types.ts:587](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L587)

Max instances
