[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSParser

# Class: SRSParser

Defined in: [src/architecture-generator/SRSParser.ts:88](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/SRSParser.ts#L88)

Parses SRS documents to extract structured data for architecture analysis

## Constructors

### Constructor

> **new SRSParser**(`options`): `SRSParser`

Defined in: [src/architecture-generator/SRSParser.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/SRSParser.ts#L91)

#### Parameters

##### options

[`SRSParserOptions`](../interfaces/SRSParserOptions.md) = `{}`

#### Returns

`SRSParser`

## Methods

### parseFile()

> **parseFile**(`filePath`): [`ParsedSRS`](../interfaces/ParsedSRS.md)

Defined in: [src/architecture-generator/SRSParser.ts:102](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/SRSParser.ts#L102)

Parse an SRS file from the given path

#### Parameters

##### filePath

`string`

#### Returns

[`ParsedSRS`](../interfaces/ParsedSRS.md)

***

### parse()

> **parse**(`content`): [`ParsedSRS`](../interfaces/ParsedSRS.md)

Defined in: [src/architecture-generator/SRSParser.ts:114](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/SRSParser.ts#L114)

Parse SRS content string

#### Parameters

##### content

`string`

#### Returns

[`ParsedSRS`](../interfaces/ParsedSRS.md)
