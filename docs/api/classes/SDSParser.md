[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSParser

# Class: SDSParser

Defined in: [src/issue-generator/SDSParser.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/SDSParser.ts#L67)

Parser for SDS markdown documents

## Constructors

### Constructor

> **new SDSParser**(`options`): `SDSParser`

Defined in: [src/issue-generator/SDSParser.ts:70](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/SDSParser.ts#L70)

#### Parameters

##### options

[`SDSParserOptions`](../interfaces/SDSParserOptions.md) = `{}`

#### Returns

`SDSParser`

## Methods

### parse()

> **parse**(`content`): [`ParsedSDS`](../interfaces/ParsedSDS.md)

Defined in: [src/issue-generator/SDSParser.ts:80](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/SDSParser.ts#L80)

Parse an SDS markdown document

#### Parameters

##### content

`string`

The markdown content to parse

#### Returns

[`ParsedSDS`](../interfaces/ParsedSDS.md)

Parsed SDS structure

#### Throws

SDSParseError if parsing fails in strict mode

***

### validate()

> **validate**(`sds`): readonly `string`[]

Defined in: [src/issue-generator/SDSParser.ts:525](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/SDSParser.ts#L525)

Validate parsed SDS structure

#### Parameters

##### sds

[`ParsedSDS`](../interfaces/ParsedSDS.md)

#### Returns

readonly `string`[]

#### Throws

SDSParseError if validation fails in strict mode
