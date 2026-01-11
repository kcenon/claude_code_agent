[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ParsedSRSFeature

# Interface: ParsedSRSFeature

Defined in: [src/sds-writer/types.ts:102](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L102)

Parsed SRS feature

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/sds-writer/types.ts:104](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L104)

Feature ID (e.g., SF-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/sds-writer/types.ts:106](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L106)

Feature name

***

### description

> `readonly` **description**: `string`

Defined in: [src/sds-writer/types.ts:108](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L108)

Description

***

### priority

> `readonly` **priority**: [`SDSPriority`](../type-aliases/SDSPriority.md)

Defined in: [src/sds-writer/types.ts:110](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L110)

Priority level

***

### sourceRequirements

> `readonly` **sourceRequirements**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:112](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L112)

Source requirement IDs

***

### useCaseIds

> `readonly` **useCaseIds**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:114](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L114)

Associated use case IDs

***

### acceptanceCriteria

> `readonly` **acceptanceCriteria**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:116](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L116)

Acceptance criteria
