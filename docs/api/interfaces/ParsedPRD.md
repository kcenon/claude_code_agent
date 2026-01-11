[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ParsedPRD

# Interface: ParsedPRD

Defined in: [src/srs-writer/types.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L55)

Parsed PRD document structure

## Properties

### metadata

> `readonly` **metadata**: [`PRDDocumentMetadata`](PRDDocumentMetadata.md)

Defined in: [src/srs-writer/types.ts:57](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L57)

Document metadata

***

### productName

> `readonly` **productName**: `string`

Defined in: [src/srs-writer/types.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L59)

Product name

***

### productDescription

> `readonly` **productDescription**: `string`

Defined in: [src/srs-writer/types.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L61)

Product description

***

### functionalRequirements

> `readonly` **functionalRequirements**: readonly [`ParsedPRDRequirement`](ParsedPRDRequirement.md)[]

Defined in: [src/srs-writer/types.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L63)

Functional requirements

***

### nonFunctionalRequirements

> `readonly` **nonFunctionalRequirements**: readonly [`ParsedNFR`](ParsedNFR.md)[]

Defined in: [src/srs-writer/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L65)

Non-functional requirements

***

### constraints

> `readonly` **constraints**: readonly [`ParsedConstraint`](ParsedConstraint.md)[]

Defined in: [src/srs-writer/types.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L67)

Constraints

***

### assumptions

> `readonly` **assumptions**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L69)

Assumptions

***

### userPersonas

> `readonly` **userPersonas**: readonly [`UserPersona`](UserPersona.md)[]

Defined in: [src/srs-writer/types.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L71)

User personas

***

### goals

> `readonly` **goals**: readonly [`Goal`](Goal.md)[]

Defined in: [src/srs-writer/types.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L73)

Goals and metrics
