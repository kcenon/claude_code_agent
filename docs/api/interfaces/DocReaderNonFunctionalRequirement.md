[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocReaderNonFunctionalRequirement

# Interface: DocReaderNonFunctionalRequirement

Defined in: [src/document-reader/types.ts:124](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L124)

Non-functional requirement extracted from PRD

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/document-reader/types.ts:126](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L126)

Requirement ID (e.g., NFR-001)

***

### title

> `readonly` **title**: `string`

Defined in: [src/document-reader/types.ts:128](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L128)

Requirement title

***

### description

> `readonly` **description**: `string`

Defined in: [src/document-reader/types.ts:130](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L130)

Detailed description

***

### category

> `readonly` **category**: [`DocReaderNFRCategory`](../type-aliases/DocReaderNFRCategory.md)

Defined in: [src/document-reader/types.ts:132](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L132)

NFR category

***

### targetMetric?

> `readonly` `optional` **targetMetric**: `string`

Defined in: [src/document-reader/types.ts:134](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L134)

Target metric (e.g., "Response time < 200ms")

***

### priority

> `readonly` **priority**: [`RequirementPriority`](../type-aliases/RequirementPriority.md)

Defined in: [src/document-reader/types.ts:136](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L136)

Priority level

***

### status

> `readonly` **status**: [`RequirementStatus`](../type-aliases/RequirementStatus.md)

Defined in: [src/document-reader/types.ts:138](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L138)

Current status

***

### sourceLocation

> `readonly` **sourceLocation**: `string`

Defined in: [src/document-reader/types.ts:140](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L140)

Source location (file:line)
