[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComponentGenerator

# Class: ComponentGenerator

Defined in: [src/component-generator/ComponentGenerator.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/ComponentGenerator.ts#L71)

Main component generator that orchestrates the design process

## Constructors

### Constructor

> **new ComponentGenerator**(`config`): `ComponentGenerator`

Defined in: [src/component-generator/ComponentGenerator.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/ComponentGenerator.ts#L77)

#### Parameters

##### config

[`ComponentGeneratorConfig`](../interfaces/ComponentGeneratorConfig.md) = `{}`

#### Returns

`ComponentGenerator`

## Methods

### generate()

> **generate**(`srs`, `options?`): [`ComponentDesign`](../interfaces/ComponentDesign.md)

Defined in: [src/component-generator/ComponentGenerator.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/ComponentGenerator.ts#L95)

Generate complete component design from parsed SRS

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### options?

[`ComponentGeneratorOptions`](../interfaces/ComponentGeneratorOptions.md)

#### Returns

[`ComponentDesign`](../interfaces/ComponentDesign.md)

***

### generateAndSave()

> **generateAndSave**(`srs`, `projectId`, `options?`): `object`

Defined in: [src/component-generator/ComponentGenerator.ts:463](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/ComponentGenerator.ts#L463)

Generate component design and save to files

#### Parameters

##### srs

[`ParsedSRS`](../interfaces/ParsedSRS.md)

##### projectId

`string`

##### options?

[`ComponentGeneratorOptions`](../interfaces/ComponentGeneratorOptions.md)

#### Returns

`object`

##### design

> **design**: [`ComponentDesign`](../interfaces/ComponentDesign.md)

##### outputPath

> **outputPath**: `string`

***

### saveDesign()

> **saveDesign**(`design`, `projectId`): `string`

Defined in: [src/component-generator/ComponentGenerator.ts:477](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/ComponentGenerator.ts#L477)

Save component design to markdown file

#### Parameters

##### design

[`ComponentDesign`](../interfaces/ComponentDesign.md)

##### projectId

`string`

#### Returns

`string`

***

### designToMarkdown()

> **designToMarkdown**(`design`): `string`

Defined in: [src/component-generator/ComponentGenerator.ts:498](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/ComponentGenerator.ts#L498)

Convert component design to markdown format

#### Parameters

##### design

[`ComponentDesign`](../interfaces/ComponentDesign.md)

#### Returns

`string`

***

### generateTypeScriptInterfaces()

> **generateTypeScriptInterfaces**(`design`): `string`

Defined in: [src/component-generator/ComponentGenerator.ts:627](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/ComponentGenerator.ts#L627)

Generate TypeScript interface definitions

#### Parameters

##### design

[`ComponentDesign`](../interfaces/ComponentDesign.md)

#### Returns

`string`
