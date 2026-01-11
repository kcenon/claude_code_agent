[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / APISpecifier

# Class: APISpecifier

Defined in: [src/sds-writer/APISpecifier.ts:72](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/APISpecifier.ts#L72)

Specifier for API endpoints from use cases

## Constructors

### Constructor

> **new APISpecifier**(`options`): `APISpecifier`

Defined in: [src/sds-writer/APISpecifier.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/APISpecifier.ts#L75)

#### Parameters

##### options

[`APISpecifierOptions`](../interfaces/APISpecifierOptions.md) = `{}`

#### Returns

`APISpecifier`

## Methods

### specify()

> **specify**(`components`, `useCases`, `nfrs`): [`APISpecificationResult`](../interfaces/APISpecificationResult.md)

Defined in: [src/sds-writer/APISpecifier.ts:86](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/APISpecifier.ts#L86)

Generate API specifications from components and use cases

#### Parameters

##### components

readonly [`SDSComponent`](../interfaces/SDSComponent.md)[]

SDS components

##### useCases

readonly [`SDSParsedUseCase`](../interfaces/SDSParsedUseCase.md)[]

Related use cases

##### nfrs

readonly [`SDSParsedNFR`](../interfaces/SDSParsedNFR.md)[]

Non-functional requirements

#### Returns

[`APISpecificationResult`](../interfaces/APISpecificationResult.md)

API specification result

***

### specifyEndpoint()

> **specifyEndpoint**(`input`): [`SDSAPIEndpoint`](../interfaces/SDSAPIEndpoint.md) \| `null`

Defined in: [src/sds-writer/APISpecifier.ts:144](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/APISpecifier.ts#L144)

Generate a single API endpoint from a use case

#### Parameters

##### input

[`APIDesignInput`](../interfaces/APIDesignInput.md)

#### Returns

[`SDSAPIEndpoint`](../interfaces/SDSAPIEndpoint.md) \| `null`
