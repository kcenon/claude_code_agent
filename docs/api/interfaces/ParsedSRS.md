[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ParsedSRS

# Interface: ParsedSRS

Defined in: [src/architecture-generator/types.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L87)

Parsed SRS document structure

## Properties

### metadata

> `readonly` **metadata**: [`SRSMetadata`](SRSMetadata.md)

Defined in: [src/architecture-generator/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L89)

Document metadata

***

### features

> `readonly` **features**: readonly [`SRSFeature`](SRSFeature.md)[]

Defined in: [src/architecture-generator/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L91)

System features

***

### nfrs

> `readonly` **nfrs**: readonly [`ArchitectureNFR`](ArchitectureNFR.md)[]

Defined in: [src/architecture-generator/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L93)

Non-functional requirements

***

### constraints

> `readonly` **constraints**: readonly [`ArchitectureConstraint`](ArchitectureConstraint.md)[]

Defined in: [src/architecture-generator/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L95)

Constraints

***

### assumptions

> `readonly` **assumptions**: readonly `string`[]

Defined in: [src/architecture-generator/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L97)

Assumptions
