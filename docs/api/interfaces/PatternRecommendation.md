[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PatternRecommendation

# Interface: PatternRecommendation

Defined in: [src/architecture-generator/types.ts:182](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L182)

Pattern recommendation with rationale

## Properties

### pattern

> `readonly` **pattern**: [`ArchitecturePattern`](../type-aliases/ArchitecturePattern.md)

Defined in: [src/architecture-generator/types.ts:184](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L184)

Pattern name

***

### score

> `readonly` **score**: `number`

Defined in: [src/architecture-generator/types.ts:186](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L186)

Recommendation score (0-100)

***

### reasons

> `readonly` **reasons**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:188](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L188)

Reasons for recommendation

***

### drawbacks

> `readonly` **drawbacks**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:190](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L190)

Potential drawbacks
