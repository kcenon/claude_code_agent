[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TraceabilityMapperOptions

# Interface: TraceabilityMapperOptions

Defined in: [src/sds-writer/TraceabilityMapper.ts:21](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L21)

Traceability mapper options

## Properties

### coverageThreshold?

> `readonly` `optional` **coverageThreshold**: `number`

Defined in: [src/sds-writer/TraceabilityMapper.ts:23](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L23)

Minimum coverage threshold (0-100)

***

### failOnLowCoverage?

> `readonly` `optional` **failOnLowCoverage**: `boolean`

Defined in: [src/sds-writer/TraceabilityMapper.ts:25](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L25)

Fail if coverage is below threshold

***

### traceUseCases?

> `readonly` `optional` **traceUseCases**: `boolean`

Defined in: [src/sds-writer/TraceabilityMapper.ts:27](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L27)

Include use case traceability

***

### tracePRDRequirements?

> `readonly` `optional` **tracePRDRequirements**: `boolean`

Defined in: [src/sds-writer/TraceabilityMapper.ts:29](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L29)

Include PRD requirement traceability
