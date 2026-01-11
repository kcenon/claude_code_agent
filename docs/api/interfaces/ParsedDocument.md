[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ParsedDocument

# Interface: ParsedDocument

Defined in: [src/document-reader/types.ts:66](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L66)

Parsed document structure

## Properties

### type

> `readonly` **type**: [`DocReaderDocumentType`](../type-aliases/DocReaderDocumentType.md)

Defined in: [src/document-reader/types.ts:68](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L68)

Document type

***

### path

> `readonly` **path**: `string`

Defined in: [src/document-reader/types.ts:70](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L70)

File path of the document

***

### metadata

> `readonly` **metadata**: [`DocumentMetadata`](DocumentMetadata.md)

Defined in: [src/document-reader/types.ts:72](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L72)

Document metadata

***

### rawContent

> `readonly` **rawContent**: `string`

Defined in: [src/document-reader/types.ts:74](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L74)

Raw markdown content

***

### sections

> `readonly` **sections**: readonly [`DocumentSection`](DocumentSection.md)[]

Defined in: [src/document-reader/types.ts:76](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L76)

Parsed sections

***

### lastModified

> `readonly` **lastModified**: `string`

Defined in: [src/document-reader/types.ts:78](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L78)

File last modified timestamp
