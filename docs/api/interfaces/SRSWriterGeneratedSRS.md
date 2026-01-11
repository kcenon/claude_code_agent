[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSWriterGeneratedSRS

# Interface: SRSWriterGeneratedSRS

Defined in: [src/srs-writer/types.ts:324](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L324)

Generated SRS document

## Properties

### metadata

> `readonly` **metadata**: [`SRSMetadata`](SRSMetadata.md)

Defined in: [src/srs-writer/types.ts:326](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L326)

SRS metadata

***

### content

> `readonly` **content**: `string`

Defined in: [src/srs-writer/types.ts:328](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L328)

Raw markdown content

***

### features

> `readonly` **features**: readonly [`SRSFeature`](SRSFeature.md)[]

Defined in: [src/srs-writer/types.ts:330](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L330)

Features in the SRS

***

### nfrs

> `readonly` **nfrs**: readonly [`ArchitectureNFR`](ArchitectureNFR.md)[]

Defined in: [src/srs-writer/types.ts:332](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L332)

NFRs in the SRS

***

### constraints

> `readonly` **constraints**: readonly [`ArchitectureConstraint`](ArchitectureConstraint.md)[]

Defined in: [src/srs-writer/types.ts:334](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L334)

Constraints in the SRS

***

### assumptions

> `readonly` **assumptions**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:336](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L336)

Assumptions

***

### traceabilityMatrix

> `readonly` **traceabilityMatrix**: [`SRSWriterTraceabilityMatrix`](SRSWriterTraceabilityMatrix.md)

Defined in: [src/srs-writer/types.ts:338](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L338)

Traceability matrix
