[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DetectionRule

# Interface: DetectionRule

Defined in: [src/mode-detector/types.ts:155](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L155)

Detection rule configuration

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/mode-detector/types.ts:157](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L157)

Rule name

***

### condition

> `readonly` **condition**: `string`

Defined in: [src/mode-detector/types.ts:159](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L159)

Condition description

***

### mode

> `readonly` **mode**: [`PipelineMode`](../type-aliases/PipelineMode.md)

Defined in: [src/mode-detector/types.ts:161](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L161)

Resulting mode if condition matches

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/mode-detector/types.ts:163](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L163)

Confidence when this rule matches

***

### priority

> `readonly` **priority**: `number`

Defined in: [src/mode-detector/types.ts:165](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L165)

Priority (higher = evaluated first)
