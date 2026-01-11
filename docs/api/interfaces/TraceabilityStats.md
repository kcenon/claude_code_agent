[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TraceabilityStats

# Interface: TraceabilityStats

Defined in: [src/sds-writer/TraceabilityMapper.ts:57](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L57)

Traceability statistics

## Properties

### totalFeatures

> `readonly` **totalFeatures**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L59)

Total SRS features

***

### coveredFeatures

> `readonly` **coveredFeatures**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L61)

Features with components

***

### totalComponents

> `readonly` **totalComponents**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L63)

Total SDS components

***

### tracedComponents

> `readonly` **tracedComponents**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L65)

Components with features

***

### forwardCoverage

> `readonly` **forwardCoverage**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L67)

Forward coverage (SRS -> SDS)

***

### backwardCoverage

> `readonly` **backwardCoverage**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L69)

Backward coverage (SDS -> SRS)

***

### totalUseCases

> `readonly` **totalUseCases**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L71)

Total use cases

***

### linkedUseCases

> `readonly` **linkedUseCases**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L73)

Use cases linked to components
