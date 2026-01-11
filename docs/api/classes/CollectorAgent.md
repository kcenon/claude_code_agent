[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CollectorAgent

# Class: CollectorAgent

Defined in: [src/collector/CollectorAgent.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L44)

CollectorAgent class for managing information collection workflow

## Constructors

### Constructor

> **new CollectorAgent**(`config`): `CollectorAgent`

Defined in: [src/collector/CollectorAgent.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L50)

#### Parameters

##### config

[`CollectorAgentConfig`](../interfaces/CollectorAgentConfig.md) = `{}`

#### Returns

`CollectorAgent`

## Methods

### startSession()

> **startSession**(`projectName?`): `Promise`\<[`CollectionSession`](../interfaces/CollectionSession.md)\>

Defined in: [src/collector/CollectorAgent.ts:70](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L70)

Start a new collection session

#### Parameters

##### projectName?

`string`

Initial project name (optional)

#### Returns

`Promise`\<[`CollectionSession`](../interfaces/CollectionSession.md)\>

The created session

***

### getSession()

> **getSession**(): [`CollectionSession`](../interfaces/CollectionSession.md) \| `null`

Defined in: [src/collector/CollectorAgent.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L113)

Get the current session

#### Returns

[`CollectionSession`](../interfaces/CollectionSession.md) \| `null`

Current session or null if none active

***

### addTextInput()

> **addTextInput**(`text`, `description?`): [`CollectionSession`](../interfaces/CollectionSession.md)

Defined in: [src/collector/CollectorAgent.ts:124](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L124)

Add text input to the current session

#### Parameters

##### text

`string`

Text content to add

##### description?

`string`

Optional description

#### Returns

[`CollectionSession`](../interfaces/CollectionSession.md)

Updated session

***

### addFileInput()

> **addFileInput**(`filePath`): `Promise`\<[`CollectionSession`](../interfaces/CollectionSession.md)\>

Defined in: [src/collector/CollectorAgent.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L137)

Add a file input to the current session

#### Parameters

##### filePath

`string`

Path to the file

#### Returns

`Promise`\<[`CollectionSession`](../interfaces/CollectionSession.md)\>

Promise resolving to updated session

***

### addUrlInput()

> **addUrlInput**(`url`): `Promise`\<[`CollectionSession`](../interfaces/CollectionSession.md)\>

Defined in: [src/collector/CollectorAgent.ts:150](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L150)

Add a URL input to the current session

#### Parameters

##### url

`string`

URL to fetch

#### Returns

`Promise`\<[`CollectionSession`](../interfaces/CollectionSession.md)\>

Promise resolving to updated session

***

### processInputs()

> **processInputs**(): [`ExtractionResult`](../interfaces/ExtractionResult.md)

Defined in: [src/collector/CollectorAgent.ts:178](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L178)

Process all collected inputs and extract information

#### Returns

[`ExtractionResult`](../interfaces/ExtractionResult.md)

ExtractionResult with all extracted information

***

### getPendingQuestions()

> **getPendingQuestions**(): readonly [`ClarificationQuestion`](../interfaces/ClarificationQuestion.md)[]

Defined in: [src/collector/CollectorAgent.ts:205](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L205)

Get pending clarification questions

#### Returns

readonly [`ClarificationQuestion`](../interfaces/ClarificationQuestion.md)[]

Array of pending questions

***

### answerQuestion()

> **answerQuestion**(`questionId`, `answer`): [`CollectionSession`](../interfaces/CollectionSession.md)

Defined in: [src/collector/CollectorAgent.ts:219](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L219)

Submit an answer to a clarification question

#### Parameters

##### questionId

`string`

ID of the question being answered

##### answer

`string`

The answer

#### Returns

[`CollectionSession`](../interfaces/CollectionSession.md)

Updated session

***

### skipClarification()

> **skipClarification**(): [`CollectionSession`](../interfaces/CollectionSession.md)

Defined in: [src/collector/CollectorAgent.ts:251](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L251)

Skip all remaining clarification questions

#### Returns

[`CollectionSession`](../interfaces/CollectionSession.md)

Updated session

***

### finalize()

> **finalize**(`projectName?`, `projectDescription?`): `Promise`\<[`CollectionResult`](../interfaces/CollectionResult.md)\>

Defined in: [src/collector/CollectorAgent.ts:271](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L271)

Finalize collection and generate output

#### Parameters

##### projectName?

`string`

Project name (required if not detected)

##### projectDescription?

`string`

Project description (required if not detected)

#### Returns

`Promise`\<[`CollectionResult`](../interfaces/CollectionResult.md)\>

CollectionResult with output path and stats

***

### reset()

> **reset**(): `void`

Defined in: [src/collector/CollectorAgent.ts:467](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L467)

Reset the agent, clearing the current session

#### Returns

`void`

***

### collectFromText()

> **collectFromText**(`text`, `options?`): `Promise`\<[`CollectionResult`](../interfaces/CollectionResult.md)\>

Defined in: [src/collector/CollectorAgent.ts:478](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L478)

Convenience method: Collect from text and finalize in one call

#### Parameters

##### text

`string`

Text content to collect from

##### options?

Optional project name and description

###### projectName?

`string`

###### projectDescription?

`string`

#### Returns

`Promise`\<[`CollectionResult`](../interfaces/CollectionResult.md)\>

CollectionResult

***

### collectFromFile()

> **collectFromFile**(`filePath`, `options?`): `Promise`\<[`CollectionResult`](../interfaces/CollectionResult.md)\>

Defined in: [src/collector/CollectorAgent.ts:504](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L504)

Convenience method: Collect from file and finalize in one call

#### Parameters

##### filePath

`string`

Path to file

##### options?

Optional project name and description

###### projectName?

`string`

###### projectDescription?

`string`

#### Returns

`Promise`\<[`CollectionResult`](../interfaces/CollectionResult.md)\>

CollectionResult

***

### collectFromFiles()

> **collectFromFiles**(`filePaths`, `options?`): `Promise`\<[`CollectionResult`](../interfaces/CollectionResult.md)\>

Defined in: [src/collector/CollectorAgent.ts:529](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/CollectorAgent.ts#L529)

Convenience method: Collect from multiple files and finalize in one call

#### Parameters

##### filePaths

readonly `string`[]

Array of file paths to process

##### options?

Optional project name and description

###### projectName?

`string`

###### projectDescription?

`string`

#### Returns

`Promise`\<[`CollectionResult`](../interfaces/CollectionResult.md)\>

CollectionResult with merged information from all files
