[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComponentDesignInput

# Interface: ComponentDesignInput

Defined in: [src/sds-writer/types.ts:743](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L743)

Component design input (for ComponentDesigner)

## Properties

### feature

> `readonly` **feature**: [`ParsedSRSFeature`](ParsedSRSFeature.md)

Defined in: [src/sds-writer/types.ts:745](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L745)

Feature to design component for

***

### useCases

> `readonly` **useCases**: readonly [`SDSParsedUseCase`](SDSParsedUseCase.md)[]

Defined in: [src/sds-writer/types.ts:747](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L747)

Related use cases

***

### nfrs

> `readonly` **nfrs**: readonly [`SDSParsedNFR`](SDSParsedNFR.md)[]

Defined in: [src/sds-writer/types.ts:749](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L749)

NFRs to consider

***

### constraints

> `readonly` **constraints**: readonly [`SDSParsedConstraint`](SDSParsedConstraint.md)[]

Defined in: [src/sds-writer/types.ts:751](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L751)

Constraints to consider

***

### componentIndex

> `readonly` **componentIndex**: `number`

Defined in: [src/sds-writer/types.ts:753](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L753)

Component index for ID generation
