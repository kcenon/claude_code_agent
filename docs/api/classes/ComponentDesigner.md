[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComponentDesigner

# Class: ComponentDesigner

Defined in: [src/sds-writer/ComponentDesigner.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/ComponentDesigner.ts#L59)

Designer for SDS components from SRS features

## Constructors

### Constructor

> **new ComponentDesigner**(`options`): `ComponentDesigner`

Defined in: [src/sds-writer/ComponentDesigner.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/ComponentDesigner.ts#L62)

#### Parameters

##### options

[`ComponentDesignerOptions`](../interfaces/ComponentDesignerOptions.md) = `{}`

#### Returns

`ComponentDesigner`

## Methods

### design()

> **design**(`features`, `useCases`, `nfrs`, `constraints`): [`ComponentDesignResult`](../interfaces/ComponentDesignResult.md)

Defined in: [src/sds-writer/ComponentDesigner.ts:74](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/ComponentDesigner.ts#L74)

Design components from SRS features

#### Parameters

##### features

readonly [`ParsedSRSFeature`](../interfaces/ParsedSRSFeature.md)[]

SRS features to design components for

##### useCases

readonly [`SDSParsedUseCase`](../interfaces/SDSParsedUseCase.md)[]

Related use cases

##### nfrs

readonly [`SDSParsedNFR`](../interfaces/SDSParsedNFR.md)[]

Non-functional requirements

##### constraints

readonly [`SDSParsedConstraint`](../interfaces/SDSParsedConstraint.md)[]

Constraints to consider

#### Returns

[`ComponentDesignResult`](../interfaces/ComponentDesignResult.md)

Component design result

***

### designComponent()

> **designComponent**(`input`): [`SDSComponent`](../interfaces/SDSComponent.md)

Defined in: [src/sds-writer/ComponentDesigner.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/ComponentDesigner.ts#L123)

Design a single component from a feature

#### Parameters

##### input

[`ComponentDesignInput`](../interfaces/ComponentDesignInput.md)

#### Returns

[`SDSComponent`](../interfaces/SDSComponent.md)
