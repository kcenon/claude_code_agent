[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SystemFeature

# Interface: SystemFeature

Defined in: [src/document-reader/types.ts:146](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L146)

System feature extracted from SRS

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/document-reader/types.ts:148](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L148)

Feature ID (e.g., SF-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/document-reader/types.ts:150](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L150)

Feature name

***

### description

> `readonly` **description**: `string`

Defined in: [src/document-reader/types.ts:152](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L152)

Feature description

***

### useCases

> `readonly` **useCases**: readonly `string`[]

Defined in: [src/document-reader/types.ts:154](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L154)

Associated use cases

***

### sourceRequirements

> `readonly` **sourceRequirements**: readonly `string`[]

Defined in: [src/document-reader/types.ts:156](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L156)

Source requirement IDs (from PRD)

***

### status

> `readonly` **status**: [`RequirementStatus`](../type-aliases/RequirementStatus.md)

Defined in: [src/document-reader/types.ts:158](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L158)

Current status

***

### sourceLocation

> `readonly` **sourceLocation**: `string`

Defined in: [src/document-reader/types.ts:160](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L160)

Source location (file:line)
