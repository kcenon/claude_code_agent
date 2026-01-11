[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSWriterAgent

# Class: SRSWriterAgent

Defined in: [src/srs-writer/SRSWriterAgent.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L55)

SRS Writer Agent class for generating SRS documents

## Constructors

### Constructor

> **new SRSWriterAgent**(`config`): `SRSWriterAgent`

Defined in: [src/srs-writer/SRSWriterAgent.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L62)

#### Parameters

##### config

[`SRSWriterAgentConfig`](../interfaces/SRSWriterAgentConfig.md) = `{}`

#### Returns

`SRSWriterAgent`

## Methods

### getSession()

> **getSession**(): [`SRSGenerationSession`](../interfaces/SRSGenerationSession.md) \| `null`

Defined in: [src/srs-writer/SRSWriterAgent.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L93)

Get the current session

#### Returns

[`SRSGenerationSession`](../interfaces/SRSGenerationSession.md) \| `null`

Current session or null if none active

***

### startSession()

> **startSession**(`projectId`): `Promise`\<[`SRSGenerationSession`](../interfaces/SRSGenerationSession.md)\>

Defined in: [src/srs-writer/SRSWriterAgent.ts:103](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L103)

Start a new SRS generation session for a project

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`SRSGenerationSession`](../interfaces/SRSGenerationSession.md)\>

The created session

***

### decompose()

> **decompose**(): [`FeatureDecompositionResult`](../interfaces/FeatureDecompositionResult.md)

Defined in: [src/srs-writer/SRSWriterAgent.ts:136](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L136)

Decompose PRD requirements into SRS features

#### Returns

[`FeatureDecompositionResult`](../interfaces/FeatureDecompositionResult.md)

Feature decomposition result

***

### buildTraceability()

> **buildTraceability**(): [`SRSWriterTraceabilityMatrix`](../interfaces/SRSWriterTraceabilityMatrix.md)

Defined in: [src/srs-writer/SRSWriterAgent.ts:179](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L179)

Build traceability matrix

#### Returns

[`SRSWriterTraceabilityMatrix`](../interfaces/SRSWriterTraceabilityMatrix.md)

Traceability matrix

***

### generate()

> **generate**(): [`SRSWriterGeneratedSRS`](../interfaces/SRSWriterGeneratedSRS.md)

Defined in: [src/srs-writer/SRSWriterAgent.ts:206](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L206)

Generate the SRS document

#### Returns

[`SRSWriterGeneratedSRS`](../interfaces/SRSWriterGeneratedSRS.md)

Generated SRS

***

### finalize()

> **finalize**(): `Promise`\<[`SRSGenerationResult`](../interfaces/SRSGenerationResult.md)\>

Defined in: [src/srs-writer/SRSWriterAgent.ts:270](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L270)

Finalize the SRS generation and save to files

#### Returns

`Promise`\<[`SRSGenerationResult`](../interfaces/SRSGenerationResult.md)\>

SRS generation result

***

### generateFromProject()

> **generateFromProject**(`projectId`): `Promise`\<[`SRSGenerationResult`](../interfaces/SRSGenerationResult.md)\>

Defined in: [src/srs-writer/SRSWriterAgent.ts:332](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L332)

Generate SRS from project ID in one call

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`SRSGenerationResult`](../interfaces/SRSGenerationResult.md)\>

SRS generation result

***

### generateFromPRDContent()

> **generateFromPRDContent**(`prdContent`, `projectId`): `Promise`\<[`SRSGenerationResult`](../interfaces/SRSGenerationResult.md)\>

Defined in: [src/srs-writer/SRSWriterAgent.ts:346](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L346)

Generate SRS directly from PRD content

#### Parameters

##### prdContent

`string`

The PRD markdown content

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`SRSGenerationResult`](../interfaces/SRSGenerationResult.md)\>

SRS generation result

***

### reset()

> **reset**(): `void`

Defined in: [src/srs-writer/SRSWriterAgent.ts:409](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/SRSWriterAgent.ts#L409)

Reset the agent, clearing the current session

#### Returns

`void`
