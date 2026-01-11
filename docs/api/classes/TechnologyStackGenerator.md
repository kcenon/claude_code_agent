[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TechnologyStackGenerator

# Class: TechnologyStackGenerator

Defined in: [src/architecture-generator/TechnologyStackGenerator.ts:268](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/TechnologyStackGenerator.ts#L268)

Generates technology stack recommendations

## Constructors

### Constructor

> **new TechnologyStackGenerator**(`includeAlternatives`): `TechnologyStackGenerator`

Defined in: [src/architecture-generator/TechnologyStackGenerator.ts:271](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/TechnologyStackGenerator.ts#L271)

#### Parameters

##### includeAlternatives

`boolean` = `true`

#### Returns

`TechnologyStackGenerator`

## Methods

### generate()

> **generate**(`srs`, `analysis`): [`TechnologyStack`](../interfaces/TechnologyStack.md)

Defined in: [src/architecture-generator/TechnologyStackGenerator.ts:278](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/TechnologyStackGenerator.ts#L278)

Generate technology stack based on analysis

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### analysis

[`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)

#### Returns

[`TechnologyStack`](../interfaces/TechnologyStack.md)
