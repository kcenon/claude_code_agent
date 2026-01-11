[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ArchitectureAnalysis

# Interface: ArchitectureAnalysis

Defined in: [src/architecture-generator/types.ts:166](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L166)

Architecture analysis result

## Properties

### primaryPattern

> `readonly` **primaryPattern**: [`ArchitecturePattern`](../type-aliases/ArchitecturePattern.md)

Defined in: [src/architecture-generator/types.ts:168](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L168)

Recommended primary pattern

***

### supportingPatterns

> `readonly` **supportingPatterns**: readonly [`ArchitecturePattern`](../type-aliases/ArchitecturePattern.md)[]

Defined in: [src/architecture-generator/types.ts:170](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L170)

Additional supporting patterns

***

### rationale

> `readonly` **rationale**: `string`

Defined in: [src/architecture-generator/types.ts:172](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L172)

Rationale for pattern selection

***

### recommendations

> `readonly` **recommendations**: readonly [`PatternRecommendation`](PatternRecommendation.md)[]

Defined in: [src/architecture-generator/types.ts:174](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L174)

Pattern recommendations based on requirements

***

### concerns

> `readonly` **concerns**: readonly [`ArchitecturalConcern`](ArchitecturalConcern.md)[]

Defined in: [src/architecture-generator/types.ts:176](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L176)

Identified architectural concerns
