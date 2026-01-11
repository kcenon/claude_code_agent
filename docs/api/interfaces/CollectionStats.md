[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CollectionStats

# Interface: CollectionStats

Defined in: [src/collector/types.ts:264](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L264)

Statistics about the collection process

## Properties

### sourcesProcessed

> `readonly` **sourcesProcessed**: `number`

Defined in: [src/collector/types.ts:266](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L266)

Number of sources processed

***

### functionalRequirements

> `readonly` **functionalRequirements**: `number`

Defined in: [src/collector/types.ts:268](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L268)

Number of functional requirements extracted

***

### nonFunctionalRequirements

> `readonly` **nonFunctionalRequirements**: `number`

Defined in: [src/collector/types.ts:270](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L270)

Number of non-functional requirements extracted

***

### constraints

> `readonly` **constraints**: `number`

Defined in: [src/collector/types.ts:272](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L272)

Number of constraints extracted

***

### assumptions

> `readonly` **assumptions**: `number`

Defined in: [src/collector/types.ts:274](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L274)

Number of assumptions extracted

***

### dependencies

> `readonly` **dependencies**: `number`

Defined in: [src/collector/types.ts:276](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L276)

Number of dependencies extracted

***

### questionsAsked

> `readonly` **questionsAsked**: `number`

Defined in: [src/collector/types.ts:278](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L278)

Number of questions asked

***

### questionsAnswered

> `readonly` **questionsAnswered**: `number`

Defined in: [src/collector/types.ts:280](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L280)

Number of questions answered

***

### processingTimeMs

> `readonly` **processingTimeMs**: `number`

Defined in: [src/collector/types.ts:282](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L282)

Total processing time in milliseconds
