[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSSRSParser

# Class: SDSSRSParser

Defined in: [src/sds-writer/SRSParser.ts:80](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SRSParser.ts#L80)

Parser for SRS markdown documents

## Constructors

### Constructor

> **new SDSSRSParser**(`options`): `SRSParser`

Defined in: [src/sds-writer/SRSParser.ts:83](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SRSParser.ts#L83)

#### Parameters

##### options

[`SDSSRSParserOptions`](../interfaces/SDSSRSParserOptions.md) = `{}`

#### Returns

`SRSParser`

## Methods

### parse()

> **parse**(`content`): [`SDSParsedSRS`](../interfaces/SDSParsedSRS.md)

Defined in: [src/sds-writer/SRSParser.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SRSParser.ts#L93)

Parse an SRS markdown document

#### Parameters

##### content

`string`

The markdown content to parse

#### Returns

[`SDSParsedSRS`](../interfaces/SDSParsedSRS.md)

Parsed SRS structure

#### Throws

SRSParseError if parsing fails in strict mode

***

### validate()

> **validate**(`srs`): readonly `string`[]

Defined in: [src/sds-writer/SRSParser.ts:825](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/SRSParser.ts#L825)

Validate parsed SRS structure

#### Parameters

##### srs

[`SDSParsedSRS`](../interfaces/SDSParsedSRS.md)

#### Returns

readonly `string`[]

#### Throws

SRSParseError if validation fails in strict mode
