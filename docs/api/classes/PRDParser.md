[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRDParser

# Class: PRDParser

Defined in: [src/srs-writer/PRDParser.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/PRDParser.ts#L44)

PRD Parser class

## Constructors

### Constructor

> **new PRDParser**(`options`): `PRDParser`

Defined in: [src/srs-writer/PRDParser.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/PRDParser.ts#L47)

#### Parameters

##### options

[`PRDParserOptions`](../interfaces/PRDParserOptions.md) = `{}`

#### Returns

`PRDParser`

## Methods

### parse()

> **parse**(`content`, `projectId`): [`ParsedPRD`](../interfaces/ParsedPRD.md)

Defined in: [src/srs-writer/PRDParser.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/PRDParser.ts#L58)

Parse a PRD markdown document

#### Parameters

##### content

`string`

The PRD markdown content

##### projectId

`string`

The project identifier

#### Returns

[`ParsedPRD`](../interfaces/ParsedPRD.md)

Parsed PRD structure
