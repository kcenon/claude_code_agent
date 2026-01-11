[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ParsedPRDRequirement

# Interface: ParsedPRDRequirement

Defined in: [src/srs-writer/types.ts:35](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L35)

Parsed PRD requirement

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/srs-writer/types.ts:37](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L37)

Requirement ID (e.g., FR-001)

***

### title

> `readonly` **title**: `string`

Defined in: [src/srs-writer/types.ts:39](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L39)

Requirement title

***

### description

> `readonly` **description**: `string`

Defined in: [src/srs-writer/types.ts:41](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L41)

Requirement description

***

### priority

> `readonly` **priority**: [`SRSPriority`](../type-aliases/SRSPriority.md)

Defined in: [src/srs-writer/types.ts:43](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L43)

Priority level

***

### acceptanceCriteria

> `readonly` **acceptanceCriteria**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:45](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L45)

Acceptance criteria

***

### dependencies

> `readonly` **dependencies**: readonly `string`[]

Defined in: [src/srs-writer/types.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L47)

Dependencies on other requirements

***

### userStory?

> `readonly` `optional` **userStory**: `string`

Defined in: [src/srs-writer/types.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L49)

User story if available
