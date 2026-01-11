[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / APIDesignInput

# Interface: APIDesignInput

Defined in: [src/sds-writer/types.ts:759](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L759)

API design input (for APISpecifier)

## Properties

### component

> `readonly` **component**: [`SDSComponent`](SDSComponent.md)

Defined in: [src/sds-writer/types.ts:761](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L761)

Component this API belongs to

***

### useCase

> `readonly` **useCase**: [`SDSParsedUseCase`](SDSParsedUseCase.md)

Defined in: [src/sds-writer/types.ts:763](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L763)

Use case this API implements

***

### nfrs

> `readonly` **nfrs**: readonly [`SDSParsedNFR`](SDSParsedNFR.md)[]

Defined in: [src/sds-writer/types.ts:765](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L765)

NFRs to consider (especially performance)

***

### apiIndex

> `readonly` **apiIndex**: `number`

Defined in: [src/sds-writer/types.ts:767](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L767)

API index for path generation
