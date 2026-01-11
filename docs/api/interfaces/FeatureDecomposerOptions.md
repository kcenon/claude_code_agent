[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FeatureDecomposerOptions

# Interface: FeatureDecomposerOptions

Defined in: [src/srs-writer/FeatureDecomposer.ts:21](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L21)

Feature decomposer options

## Properties

### maxFeaturesPerRequirement?

> `readonly` `optional` **maxFeaturesPerRequirement**: `number`

Defined in: [src/srs-writer/FeatureDecomposer.ts:23](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L23)

Maximum features per requirement

***

### minFeaturesPerRequirement?

> `readonly` `optional` **minFeaturesPerRequirement**: `number`

Defined in: [src/srs-writer/FeatureDecomposer.ts:25](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L25)

Minimum features per requirement

***

### generateSubFeatures?

> `readonly` `optional` **generateSubFeatures**: `boolean`

Defined in: [src/srs-writer/FeatureDecomposer.ts:27](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L27)

Generate sub-features for complex requirements

***

### useAdvancedUseCaseGeneration?

> `readonly` `optional` **useAdvancedUseCaseGeneration**: `boolean`

Defined in: [src/srs-writer/FeatureDecomposer.ts:29](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L29)

Use advanced UseCaseGenerator for detailed use cases

***

### useCaseGeneratorOptions?

> `readonly` `optional` **useCaseGeneratorOptions**: `UseCaseGeneratorOptions`

Defined in: [src/srs-writer/FeatureDecomposer.ts:31](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/FeatureDecomposer.ts#L31)

Options for UseCaseGenerator when useAdvancedUseCaseGeneration is true
