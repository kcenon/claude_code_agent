[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InputParser

# Class: InputParser

Defined in: [src/collector/InputParser.ts:72](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L72)

InputParser class for processing various input sources

## Constructors

### Constructor

> **new InputParser**(`options`): `InputParser`

Defined in: [src/collector/InputParser.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L75)

#### Parameters

##### options

[`InputParserOptions`](../interfaces/InputParserOptions.md) = `{}`

#### Returns

`InputParser`

## Methods

### parseText()

> **parseText**(`text`, `description?`): [`InputSource`](../interfaces/InputSource.md)

Defined in: [src/collector/InputParser.ts:86](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L86)

Parse text content as an input source

#### Parameters

##### text

`string`

The text content to parse

##### description?

`string`

Optional description of the text source

#### Returns

[`InputSource`](../interfaces/InputSource.md)

InputSource representing the text

***

### parseFile()

> **parseFile**(`filePath`): `Promise`\<[`InputSource`](../interfaces/InputSource.md)\>

Defined in: [src/collector/InputParser.ts:108](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L108)

Parse a file and extract its content

#### Parameters

##### filePath

`string`

Path to the file

#### Returns

`Promise`\<[`InputSource`](../interfaces/InputSource.md)\>

Promise resolving to InputSource

***

### parseFileContent()

> **parseFileContent**(`filePath`): `Promise`\<[`FileParseResult`](../interfaces/FileParseResult.md)\>

Defined in: [src/collector/InputParser.ts:131](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L131)

Parse file content based on file type

#### Parameters

##### filePath

`string`

Path to the file

#### Returns

`Promise`\<[`FileParseResult`](../interfaces/FileParseResult.md)\>

FileParseResult with parsed content

***

### parseUrl()

> **parseUrl**(`url`): `Promise`\<[`InputSource`](../interfaces/InputSource.md)\>

Defined in: [src/collector/InputParser.ts:331](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L331)

Fetch and parse URL content

#### Parameters

##### url

`string`

URL to fetch

#### Returns

`Promise`\<[`InputSource`](../interfaces/InputSource.md)\>

Promise resolving to InputSource

***

### fetchUrlContent()

> **fetchUrlContent**(`url`): `Promise`\<[`UrlFetchResult`](../interfaces/UrlFetchResult.md)\>

Defined in: [src/collector/InputParser.ts:354](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L354)

Fetch URL content

#### Parameters

##### url

`string`

URL to fetch

#### Returns

`Promise`\<[`UrlFetchResult`](../interfaces/UrlFetchResult.md)\>

UrlFetchResult with fetched content

***

### combineInputs()

> **combineInputs**(`sources`): [`ParsedInput`](../interfaces/ParsedInput.md)

Defined in: [src/collector/InputParser.ts:551](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L551)

Combine multiple input sources into a ParsedInput

#### Parameters

##### sources

readonly [`InputSource`](../interfaces/InputSource.md)[]

Array of input sources

#### Returns

[`ParsedInput`](../interfaces/ParsedInput.md)

ParsedInput with combined content

***

### isExtensionSupported()

> `static` **isExtensionSupported**(`extension`): `boolean`

Defined in: [src/collector/InputParser.ts:625](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L625)

Check if a file extension is supported

#### Parameters

##### extension

`string`

File extension (with or without dot)

#### Returns

`boolean`

True if supported

***

### getSupportedExtensions()

> `static` **getSupportedExtensions**(): readonly `string`[]

Defined in: [src/collector/InputParser.ts:635](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L635)

Get all supported file extensions

#### Returns

readonly `string`[]

Array of supported extensions

***

### parseFileSync()

> **parseFileSync**(`filePath`): [`FileParseResult`](../interfaces/FileParseResult.md)

Defined in: [src/collector/InputParser.ts:646](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L646)

Parse file content synchronously

#### Parameters

##### filePath

`string`

Path to the file

#### Returns

[`FileParseResult`](../interfaces/FileParseResult.md)

FileParseResult with parsed content

#### Note

PDF and DOCX files require async parsing - use parseFile() instead

***

### requiresAsyncParsing()

> `static` **requiresAsyncParsing**(`extension`): `boolean`

Defined in: [src/collector/InputParser.ts:717](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L717)

Check if a file type requires async parsing

#### Parameters

##### extension

`string`

File extension

#### Returns

`boolean`

True if the file type requires async parsing
