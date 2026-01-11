[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / UseCaseInput

# Interface: UseCaseInput

Defined in: [src/srs-writer/types.ts:228](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L228)

Use case generation input

## Properties

### feature

> `readonly` **feature**: [`SRSFeature`](SRSFeature.md)

Defined in: [src/srs-writer/types.ts:230](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L230)

Feature this use case belongs to

***

### requirement

> `readonly` **requirement**: [`ParsedPRDRequirement`](ParsedPRDRequirement.md)

Defined in: [src/srs-writer/types.ts:232](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L232)

Requirement it traces to

***

### actors

> `readonly` **actors**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:234](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L234)

Available actors from personas
