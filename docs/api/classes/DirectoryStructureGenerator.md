[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DirectoryStructureGenerator

# Class: DirectoryStructureGenerator

Defined in: [src/architecture-generator/DirectoryStructureGenerator.ts:609](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DirectoryStructureGenerator.ts#L609)

Generates directory structure based on architecture pattern

## Constructors

### Constructor

> **new DirectoryStructureGenerator**(): `DirectoryStructureGenerator`

#### Returns

`DirectoryStructureGenerator`

## Methods

### toAsciiTree()

> `static` **toAsciiTree**(`structure`): `string`

Defined in: [src/architecture-generator/DirectoryStructureGenerator.ts:802](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DirectoryStructureGenerator.ts#L802)

Generate ASCII tree representation

#### Parameters

##### structure

[`DirectoryStructure`](../interfaces/DirectoryStructure.md)

#### Returns

`string`

***

### generate()

> **generate**(`srs`, `analysis`, `stack`): [`DirectoryStructure`](../interfaces/DirectoryStructure.md)

Defined in: [src/architecture-generator/DirectoryStructureGenerator.ts:613](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/DirectoryStructureGenerator.ts#L613)

Generate directory structure

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### analysis

[`ArchitectureAnalysis`](../interfaces/ArchitectureAnalysis.md)

##### stack

[`TechnologyStack`](../interfaces/TechnologyStack.md)

#### Returns

[`DirectoryStructure`](../interfaces/DirectoryStructure.md)
