[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSWriterTraceabilityMatrix

# Interface: SRSWriterTraceabilityMatrix

Defined in: [src/srs-writer/types.ts:264](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L264)

Traceability matrix

## Properties

### entries

> `readonly` **entries**: readonly [`SRSTraceabilityEntry`](SRSTraceabilityEntry.md)[]

Defined in: [src/srs-writer/types.ts:266](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L266)

All entries

***

### forwardCoverage

> `readonly` **forwardCoverage**: `number`

Defined in: [src/srs-writer/types.ts:268](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L268)

Forward coverage (PRD -> SRS)

***

### orphanFeatures

> `readonly` **orphanFeatures**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:270](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L270)

Orphan features (not traced to any requirement)

***

### uncoveredRequirements

> `readonly` **uncoveredRequirements**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:272](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L272)

Uncovered requirements
