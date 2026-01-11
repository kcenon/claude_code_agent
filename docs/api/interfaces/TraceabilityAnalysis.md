[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TraceabilityAnalysis

# Interface: TraceabilityAnalysis

Defined in: [src/sds-writer/TraceabilityMapper.ts:45](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L45)

Traceability analysis result

## Properties

### matrix

> `readonly` **matrix**: [`SDSTraceabilityMatrix`](SDSTraceabilityMatrix.md)

Defined in: [src/sds-writer/TraceabilityMapper.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L47)

Complete traceability matrix

***

### stats

> `readonly` **stats**: [`TraceabilityStats`](TraceabilityStats.md)

Defined in: [src/sds-writer/TraceabilityMapper.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L49)

Coverage statistics

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/sds-writer/TraceabilityMapper.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L51)

Warnings about incomplete traceability
