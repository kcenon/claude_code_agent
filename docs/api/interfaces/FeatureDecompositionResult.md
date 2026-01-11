[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FeatureDecompositionResult

# Interface: FeatureDecompositionResult

Defined in: [src/srs-writer/types.ts:147](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L147)

Feature decomposition result

## Properties

### features

> `readonly` **features**: readonly [`SRSFeature`](SRSFeature.md)[]

Defined in: [src/srs-writer/types.ts:149](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L149)

Generated features

***

### traceabilityMap

> `readonly` **traceabilityMap**: `ReadonlyMap`\<`string`, readonly `string`[]\>

Defined in: [src/srs-writer/types.ts:151](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L151)

Traceability map (FR-XXX -> SF-XXX[])

***

### coverage

> `readonly` **coverage**: `number`

Defined in: [src/srs-writer/types.ts:153](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L153)

Coverage percentage (0-100)

***

### unmappedRequirements

> `readonly` **unmappedRequirements**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:155](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L155)

Any unmapped requirements
