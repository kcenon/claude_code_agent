[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ArchitectureAnalyzer

# Class: ArchitectureAnalyzer

Defined in: [src/architecture-generator/ArchitectureAnalyzer.ts:96](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureAnalyzer.ts#L96)

Analyzes SRS to determine appropriate architecture patterns

## Constructors

### Constructor

> **new ArchitectureAnalyzer**(`defaultPattern`): `ArchitectureAnalyzer`

Defined in: [src/architecture-generator/ArchitectureAnalyzer.ts:99](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureAnalyzer.ts#L99)

#### Parameters

##### defaultPattern

[`ArchitecturePattern`](../type-aliases/ArchitecturePattern.md) = `'layered'`

#### Returns

`ArchitectureAnalyzer`

## Methods

### analyze()

> **analyze**(`srs`): [`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)

Defined in: [src/architecture-generator/ArchitectureAnalyzer.ts:106](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureAnalyzer.ts#L106)

Analyze SRS and recommend architecture patterns

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

#### Returns

[`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)
