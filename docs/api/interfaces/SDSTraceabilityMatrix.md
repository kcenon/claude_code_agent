[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSTraceabilityMatrix

# Interface: SDSTraceabilityMatrix

Defined in: [src/sds-writer/types.ts:607](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L607)

Traceability matrix

## Properties

### entries

> `readonly` **entries**: readonly [`SDSTraceabilityEntry`](SDSTraceabilityEntry.md)[]

Defined in: [src/sds-writer/types.ts:609](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L609)

All entries

***

### forwardCoverage

> `readonly` **forwardCoverage**: `number`

Defined in: [src/sds-writer/types.ts:611](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L611)

Forward coverage (SRS -> SDS)

***

### orphanComponents

> `readonly` **orphanComponents**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:613](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L613)

Orphan components (not traced to any feature)

***

### uncoveredFeatures

> `readonly` **uncoveredFeatures**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:615](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L615)

Uncovered features
