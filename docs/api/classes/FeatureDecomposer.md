[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FeatureDecomposer

# Class: FeatureDecomposer

Defined in: [src/srs-writer/FeatureDecomposer.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L50)

Feature Decomposer class

## Constructors

### Constructor

> **new FeatureDecomposer**(`options`): `FeatureDecomposer`

Defined in: [src/srs-writer/FeatureDecomposer.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L58)

#### Parameters

##### options

[`FeatureDecomposerOptions`](../interfaces/FeatureDecomposerOptions.md) = `{}`

#### Returns

`FeatureDecomposer`

## Methods

### getDetailedUseCases()

> **getDetailedUseCases**(): readonly `DetailedUseCase`[]

Defined in: [src/srs-writer/FeatureDecomposer.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L71)

Get the detailed use cases generated during decomposition
Only available when useAdvancedUseCaseGeneration is enabled

#### Returns

readonly `DetailedUseCase`[]

Array of detailed use cases

***

### decompose()

> **decompose**(`parsedPRD`): [`FeatureDecompositionResult`](../interfaces/FeatureDecompositionResult.md)

Defined in: [src/srs-writer/FeatureDecomposer.ts:81](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L81)

Decompose PRD requirements into SRS features

#### Parameters

##### parsedPRD

[`ParsedPRD`](../interfaces/ParsedPRD.md)

Parsed PRD document

#### Returns

[`FeatureDecompositionResult`](../interfaces/FeatureDecompositionResult.md)

Feature decomposition result
