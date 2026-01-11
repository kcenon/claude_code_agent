[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocumentMetadata

# Interface: DocumentMetadata

Defined in: [src/document-reader/types.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L46)

Document metadata extracted from frontmatter or headers

## Properties

### id?

> `readonly` `optional` **id**: `string`

Defined in: [src/document-reader/types.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L48)

Document ID (e.g., PRD-001)

***

### title

> `readonly` **title**: `string`

Defined in: [src/document-reader/types.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L50)

Document title

***

### version?

> `readonly` `optional` **version**: `string`

Defined in: [src/document-reader/types.ts:52](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L52)

Document version

***

### status?

> `readonly` `optional` **status**: `string`

Defined in: [src/document-reader/types.ts:54](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L54)

Document status (Draft, Review, Approved)

***

### createdAt?

> `readonly` `optional` **createdAt**: `string`

Defined in: [src/document-reader/types.ts:56](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L56)

Creation date

***

### updatedAt?

> `readonly` `optional` **updatedAt**: `string`

Defined in: [src/document-reader/types.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L58)

Last update date

***

### author?

> `readonly` `optional` **author**: `string`

Defined in: [src/document-reader/types.ts:60](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L60)

Document author
