[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocumentSection

# Interface: DocumentSection

Defined in: [src/document-reader/types.ts:84](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L84)

Document section structure

## Properties

### title

> `readonly` **title**: `string`

Defined in: [src/document-reader/types.ts:86](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L86)

Section title

***

### level

> `readonly` **level**: `number`

Defined in: [src/document-reader/types.ts:88](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L88)

Section level (1-6)

***

### content

> `readonly` **content**: `string`

Defined in: [src/document-reader/types.ts:90](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L90)

Section content

***

### children

> `readonly` **children**: readonly `DocumentSection`[]

Defined in: [src/document-reader/types.ts:92](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L92)

Child sections

***

### startLine

> `readonly` **startLine**: `number`

Defined in: [src/document-reader/types.ts:94](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L94)

Line number where section starts
