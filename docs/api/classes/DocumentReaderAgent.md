[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocumentReaderAgent

# Class: DocumentReaderAgent

Defined in: [src/document-reader/DocumentReaderAgent.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/DocumentReaderAgent.ts#L58)

Document Reader Agent class

Responsible for:
- Parsing PRD, SRS, SDS markdown documents
- Extracting requirements, features, and components
- Building traceability mappings
- Generating current_state.yaml output

## Constructors

### Constructor

> **new DocumentReaderAgent**(`config`): `DocumentReaderAgent`

Defined in: [src/document-reader/DocumentReaderAgent.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/DocumentReaderAgent.ts#L62)

#### Parameters

##### config

[`DocumentReaderConfig`](../interfaces/DocumentReaderConfig.md) = `{}`

#### Returns

`DocumentReaderAgent`

## Methods

### startSession()

> **startSession**(`projectId`): `Promise`\<[`DocumentReadingSession`](../interfaces/DocumentReadingSession.md)\>

Defined in: [src/document-reader/DocumentReaderAgent.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/DocumentReaderAgent.ts#L69)

Start a new document reading session

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`DocumentReadingSession`](../interfaces/DocumentReadingSession.md)\>

***

### readDocuments()

> **readDocuments**(): `Promise`\<[`DocumentReadingResult`](../interfaces/DocumentReadingResult.md)\>

Defined in: [src/document-reader/DocumentReaderAgent.ts:90](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/DocumentReaderAgent.ts#L90)

Read and process all documents in the project

#### Returns

`Promise`\<[`DocumentReadingResult`](../interfaces/DocumentReadingResult.md)\>

***

### getSession()

> **getSession**(): [`DocumentReadingSession`](../interfaces/DocumentReadingSession.md) \| `null`

Defined in: [src/document-reader/DocumentReaderAgent.ts:229](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/DocumentReaderAgent.ts#L229)

Get the current session

#### Returns

[`DocumentReadingSession`](../interfaces/DocumentReadingSession.md) \| `null`

***

### reset()

> **reset**(): `void`

Defined in: [src/document-reader/DocumentReaderAgent.ts:236](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/DocumentReaderAgent.ts#L236)

Reset the agent state

#### Returns

`void`
