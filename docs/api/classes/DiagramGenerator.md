[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DiagramGenerator

# Class: DiagramGenerator

Defined in: [src/architecture-generator/DiagramGenerator.ts:27](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DiagramGenerator.ts#L27)

Generates Mermaid diagrams based on architecture analysis

## Constructors

### Constructor

> **new DiagramGenerator**(`generateAllTypes`): `DiagramGenerator`

Defined in: [src/architecture-generator/DiagramGenerator.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DiagramGenerator.ts#L30)

#### Parameters

##### generateAllTypes

`boolean` = `false`

#### Returns

`DiagramGenerator`

## Methods

### generate()

> **generate**(`srs`, `analysis`): [`MermaidDiagram`](../interfaces/MermaidDiagram.md)[]

Defined in: [src/architecture-generator/DiagramGenerator.ts:37](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DiagramGenerator.ts#L37)

Generate all diagrams for the architecture

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### analysis

[`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)

#### Returns

[`MermaidDiagram`](../interfaces/MermaidDiagram.md)[]

***

### generateArchitectureOverview()

> **generateArchitectureOverview**(`srs`, `analysis`): [`MermaidDiagram`](../interfaces/MermaidDiagram.md)

Defined in: [src/architecture-generator/DiagramGenerator.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DiagramGenerator.ts#L63)

Generate architecture overview diagram

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### analysis

[`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)

#### Returns

[`MermaidDiagram`](../interfaces/MermaidDiagram.md)

***

### generateComponentInteraction()

> **generateComponentInteraction**(`srs`, `analysis`): [`MermaidDiagram`](../interfaces/MermaidDiagram.md)

Defined in: [src/architecture-generator/DiagramGenerator.ts:94](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DiagramGenerator.ts#L94)

Generate component interaction diagram

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### analysis

[`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)

#### Returns

[`MermaidDiagram`](../interfaces/MermaidDiagram.md)

***

### generateDeploymentDiagram()

> **generateDeploymentDiagram**(`analysis`): [`MermaidDiagram`](../interfaces/MermaidDiagram.md)

Defined in: [src/architecture-generator/DiagramGenerator.ts:130](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DiagramGenerator.ts#L130)

Generate deployment diagram

#### Parameters

##### analysis

[`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)

#### Returns

[`MermaidDiagram`](../interfaces/MermaidDiagram.md)

***

### generateDataFlowDiagram()

> **generateDataFlowDiagram**(`srs`, `_analysis`): [`MermaidDiagram`](../interfaces/MermaidDiagram.md)

Defined in: [src/architecture-generator/DiagramGenerator.ts:153](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DiagramGenerator.ts#L153)

Generate data flow diagram

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### \_analysis

[`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)

#### Returns

[`MermaidDiagram`](../interfaces/MermaidDiagram.md)
