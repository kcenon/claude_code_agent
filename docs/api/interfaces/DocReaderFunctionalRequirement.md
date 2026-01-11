[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocReaderFunctionalRequirement

# Interface: DocReaderFunctionalRequirement

Defined in: [src/document-reader/types.ts:100](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L100)

Functional requirement extracted from PRD

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/document-reader/types.ts:102](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L102)

Requirement ID (e.g., FR-001)

***

### title

> `readonly` **title**: `string`

Defined in: [src/document-reader/types.ts:104](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L104)

Requirement title

***

### description

> `readonly` **description**: `string`

Defined in: [src/document-reader/types.ts:106](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L106)

Detailed description

***

### priority

> `readonly` **priority**: [`RequirementPriority`](../type-aliases/RequirementPriority.md)

Defined in: [src/document-reader/types.ts:108](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L108)

Priority level

***

### status

> `readonly` **status**: [`RequirementStatus`](../type-aliases/RequirementStatus.md)

Defined in: [src/document-reader/types.ts:110](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L110)

Current status

***

### userStory?

> `readonly` `optional` **userStory**: `string`

Defined in: [src/document-reader/types.ts:112](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L112)

User story if available

***

### acceptanceCriteria?

> `readonly` `optional` **acceptanceCriteria**: readonly `string`[]

Defined in: [src/document-reader/types.ts:114](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L114)

Acceptance criteria

***

### dependencies?

> `readonly` `optional` **dependencies**: readonly `string`[]

Defined in: [src/document-reader/types.ts:116](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L116)

Dependencies on other requirements

***

### sourceLocation

> `readonly` **sourceLocation**: `string`

Defined in: [src/document-reader/types.ts:118](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L118)

Source location (file:line)
