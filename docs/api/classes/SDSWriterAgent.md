[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSWriterAgent

# Class: SDSWriterAgent

Defined in: [src/sds-writer/SDSWriterAgent.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SDSWriterAgent.ts#L95)

SDS Writer Agent class

Orchestrates the generation of SDS documents from SRS.

## Constructors

### Constructor

> **new SDSWriterAgent**(`config`): `SDSWriterAgent`

Defined in: [src/sds-writer/SDSWriterAgent.ts:104](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SDSWriterAgent.ts#L104)

#### Parameters

##### config

[`SDSWriterAgentConfig`](../interfaces/SDSWriterAgentConfig.md) = `{}`

#### Returns

`SDSWriterAgent`

## Methods

### getSession()

> **getSession**(): [`SDSGenerationSession`](../interfaces/SDSGenerationSession.md) \| `null`

Defined in: [src/sds-writer/SDSWriterAgent.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SDSWriterAgent.ts#L119)

Get the current session

#### Returns

[`SDSGenerationSession`](../interfaces/SDSGenerationSession.md) \| `null`

***

### startSession()

> **startSession**(`projectId`): `Promise`\<[`SDSGenerationSession`](../interfaces/SDSGenerationSession.md)\>

Defined in: [src/sds-writer/SDSWriterAgent.ts:128](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SDSWriterAgent.ts#L128)

Start a new SDS generation session

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`SDSGenerationSession`](../interfaces/SDSGenerationSession.md)\>

The new session

***

### generateFromProject()

> **generateFromProject**(`projectId`): `Promise`\<[`SDSGenerationResult`](../interfaces/SDSGenerationResult.md)\>

Defined in: [src/sds-writer/SDSWriterAgent.ts:166](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SDSWriterAgent.ts#L166)

Generate SDS from a project

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`SDSGenerationResult`](../interfaces/SDSGenerationResult.md)\>

Generation result

***

### generateFromParsedSRS()

> **generateFromParsedSRS**(`parsedSRS`): `Promise`\<[`SDSGenerationResult`](../interfaces/SDSGenerationResult.md)\>

Defined in: [src/sds-writer/SDSWriterAgent.ts:294](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SDSWriterAgent.ts#L294)

Generate SDS from already parsed SRS

#### Parameters

##### parsedSRS

[`SDSParsedSRS`](../interfaces/SDSParsedSRS.md)

Parsed SRS document

#### Returns

`Promise`\<[`SDSGenerationResult`](../interfaces/SDSGenerationResult.md)\>

Generation result

***

### finalize()

> **finalize**(): `Promise`\<[`SDSGenerationResult`](../interfaces/SDSGenerationResult.md)\>

Defined in: [src/sds-writer/SDSWriterAgent.ts:314](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SDSWriterAgent.ts#L314)

Finalize the current session

#### Returns

`Promise`\<[`SDSGenerationResult`](../interfaces/SDSGenerationResult.md)\>

Generation result
