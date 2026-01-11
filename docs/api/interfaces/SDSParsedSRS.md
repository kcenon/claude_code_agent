[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSParsedSRS

# Interface: SDSParsedSRS

Defined in: [src/sds-writer/types.ts:60](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L60)

Parsed SRS document structure

## Properties

### metadata

> `readonly` **metadata**: [`SRSDocumentMetadata`](SRSDocumentMetadata.md)

Defined in: [src/sds-writer/types.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L62)

Document metadata

***

### productName

> `readonly` **productName**: `string`

Defined in: [src/sds-writer/types.ts:64](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L64)

Product information

***

### productDescription

> `readonly` **productDescription**: `string`

Defined in: [src/sds-writer/types.ts:66](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L66)

Product description

***

### features

> `readonly` **features**: readonly [`ParsedSRSFeature`](ParsedSRSFeature.md)[]

Defined in: [src/sds-writer/types.ts:68](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L68)

Software features

***

### nfrs

> `readonly` **nfrs**: readonly [`SDSParsedNFR`](SDSParsedNFR.md)[]

Defined in: [src/sds-writer/types.ts:70](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L70)

Non-functional requirements

***

### constraints

> `readonly` **constraints**: readonly [`SDSParsedConstraint`](SDSParsedConstraint.md)[]

Defined in: [src/sds-writer/types.ts:72](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L72)

Constraints

***

### assumptions

> `readonly` **assumptions**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:74](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L74)

Assumptions

***

### useCases

> `readonly` **useCases**: readonly [`SDSParsedUseCase`](SDSParsedUseCase.md)[]

Defined in: [src/sds-writer/types.ts:76](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L76)

Use cases
