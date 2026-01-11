[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ArchitectureGenerator

# Class: ArchitectureGenerator

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L65)

Main architecture generator that orchestrates the design process

## Constructors

### Constructor

> **new ArchitectureGenerator**(`config`): `ArchitectureGenerator`

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L73)

#### Parameters

##### config

[`ArchitectureGeneratorConfig`](../interfaces/ArchitectureGeneratorConfig.md) = `{}`

#### Returns

`ArchitectureGenerator`

## Methods

### generateFromFile()

> **generateFromFile**(`srsPath`, `options?`): [`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:105](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L105)

Generate complete architecture design from SRS file

#### Parameters

##### srsPath

`string`

##### options?

[`ArchitectureGeneratorOptions`](../interfaces/ArchitectureGeneratorOptions.md)

#### Returns

[`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

***

### generateFromContent()

> **generateFromContent**(`srsContent`, `options?`): [`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:120](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L120)

Generate complete architecture design from SRS content

#### Parameters

##### srsContent

`string`

##### options?

[`ArchitectureGeneratorOptions`](../interfaces/ArchitectureGeneratorOptions.md)

#### Returns

[`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

***

### generateFromParsedSRS()

> **generateFromParsedSRS**(`srs`, `options?`): [`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L135)

Generate complete architecture design from parsed SRS

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### options?

[`ArchitectureGeneratorOptions`](../interfaces/ArchitectureGeneratorOptions.md)

#### Returns

[`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

***

### generateAndSave()

> **generateAndSave**(`srsPath`, `projectId`, `options?`): `object`

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:195](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L195)

Generate architecture and save to files

#### Parameters

##### srsPath

`string`

##### projectId

`string`

##### options?

[`ArchitectureGeneratorOptions`](../interfaces/ArchitectureGeneratorOptions.md)

#### Returns

`object`

##### design

> **design**: [`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

##### outputPath

> **outputPath**: `string`

***

### saveDesign()

> **saveDesign**(`design`, `projectId`): `string`

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:209](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L209)

Save architecture design to markdown file

#### Parameters

##### design

[`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

##### projectId

`string`

#### Returns

`string`

***

### designToMarkdown()

> **designToMarkdown**(`design`): `string`

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:231](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L231)

Convert architecture design to markdown format

#### Parameters

##### design

[`ArchitectureDesign`](../interfaces/ArchitectureDesign.md)

#### Returns

`string`

***

### getSRSPath()

> **getSRSPath**(`projectId`): `string`

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:383](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L383)

Get SRS file path for a project

#### Parameters

##### projectId

`string`

#### Returns

`string`

***

### srsExists()

> **srsExists**(`projectId`): `boolean`

Defined in: [src/architecture-generator/ArchitectureGenerator.ts:390](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/ArchitectureGenerator.ts#L390)

Check if SRS exists for a project

#### Parameters

##### projectId

`string`

#### Returns

`boolean`
