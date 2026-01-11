[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / IssueGenerator

# Class: IssueGenerator

Defined in: [src/issue-generator/IssueGenerator.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L65)

Main Issue Generator class

Orchestrates the transformation of SDS documents into GitHub Issues
with proper dependencies, labels, and effort estimates.

## Constructors

### Constructor

> **new IssueGenerator**(`config`): `IssueGenerator`

Defined in: [src/issue-generator/IssueGenerator.ts:72](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L72)

#### Parameters

##### config

[`IssueGeneratorConfig`](../interfaces/IssueGeneratorConfig.md) = `{}`

#### Returns

`IssueGenerator`

## Methods

### generateFromFile()

> **generateFromFile**(`sdsPath`, `projectId`): `Promise`\<[`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)\>

Defined in: [src/issue-generator/IssueGenerator.ts:86](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L86)

Generate issues from an SDS file

#### Parameters

##### sdsPath

`string`

Path to the SDS markdown file

##### projectId

`string`

Project identifier for output

#### Returns

`Promise`\<[`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)\>

Issue generation result

***

### generate()

> **generate**(`sdsContent`): [`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)

Defined in: [src/issue-generator/IssueGenerator.ts:112](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L112)

Generate issues from SDS content

#### Parameters

##### sdsContent

`string`

SDS markdown content

#### Returns

[`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)

Issue generation result

***

### generateFromParsed()

> **generateFromParsed**(`sds`): [`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)

Defined in: [src/issue-generator/IssueGenerator.ts:149](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L149)

Generate issues from a parsed SDS

#### Parameters

##### sds

[`ParsedSDS`](../interfaces/ParsedSDS.md)

Already parsed SDS

#### Returns

[`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)

Issue generation result

***

### parse()

> **parse**(`content`): [`ParsedSDS`](../interfaces/ParsedSDS.md)

Defined in: [src/issue-generator/IssueGenerator.ts:183](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L183)

Parse SDS content without generating issues

#### Parameters

##### content

`string`

SDS markdown content

#### Returns

[`ParsedSDS`](../interfaces/ParsedSDS.md)

Parsed SDS structure

***

### validate()

> **validate**(`content`): readonly `string`[]

Defined in: [src/issue-generator/IssueGenerator.ts:192](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L192)

Validate SDS content

#### Parameters

##### content

`string`

SDS markdown content

#### Returns

readonly `string`[]

Array of validation errors (empty if valid)

***

### getExecutionOrder()

> **getExecutionOrder**(`result`): readonly `string`[]

Defined in: [src/issue-generator/IssueGenerator.ts:319](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L319)

Get execution order for issues

#### Parameters

##### result

[`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)

Issue generation result

#### Returns

readonly `string`[]

Ordered issue IDs for execution

***

### getParallelGroups()

> **getParallelGroups**(`result`): readonly `object`[]

Defined in: [src/issue-generator/IssueGenerator.ts:328](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L328)

Get issues that can be executed in parallel

#### Parameters

##### result

[`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)

Issue generation result

#### Returns

readonly `object`[]

Groups of parallel-executable issues

***

### getGraphStatistics()

> **getGraphStatistics**(`result`): `object`

Defined in: [src/issue-generator/IssueGenerator.ts:342](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L342)

Get graph statistics

#### Parameters

##### result

[`IssueGenerationResult`](../interfaces/IssueGenerationResult.md)

#### Returns

`object`

##### totalNodes

> **totalNodes**: `number`

##### totalEdges

> **totalEdges**: `number`

##### maxDepth

> **maxDepth**: `number`

##### rootNodes

> **rootNodes**: `number`

##### leafNodes

> **leafNodes**: `number`
