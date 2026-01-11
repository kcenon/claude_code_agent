[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ArchitectureDesign

# Interface: ArchitectureDesign

Defined in: [src/architecture-generator/types.ts:316](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L316)

Complete architecture design result

## Properties

### analysis

> `readonly` **analysis**: [`ArchitectureAnalysis`](ArchitectureAnalysis.md)

Defined in: [src/architecture-generator/types.ts:318](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L318)

Architecture analysis

***

### technologyStack

> `readonly` **technologyStack**: [`TechnologyStack`](TechnologyStack.md)

Defined in: [src/architecture-generator/types.ts:320](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L320)

Technology stack recommendation

***

### diagrams

> `readonly` **diagrams**: readonly [`MermaidDiagram`](MermaidDiagram.md)[]

Defined in: [src/architecture-generator/types.ts:322](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L322)

Generated diagrams

***

### directoryStructure

> `readonly` **directoryStructure**: [`DirectoryStructure`](DirectoryStructure.md)

Defined in: [src/architecture-generator/types.ts:324](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L324)

Directory structure

***

### metadata

> `readonly` **metadata**: [`ArchitectureMetadata`](ArchitectureMetadata.md)

Defined in: [src/architecture-generator/types.ts:326](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L326)

Design metadata
