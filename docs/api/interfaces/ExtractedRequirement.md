[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ExtractedRequirement

# Interface: ExtractedRequirement

Defined in: [src/collector/types.ts:64](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L64)

Extracted requirement from input

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/collector/types.ts:66](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L66)

Generated requirement ID (e.g., FR-001)

***

### title

> `readonly` **title**: `string`

Defined in: [src/collector/types.ts:68](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L68)

Requirement title

***

### description

> `readonly` **description**: `string`

Defined in: [src/collector/types.ts:70](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L70)

Detailed description

***

### priority

> `readonly` **priority**: `"P0"` \| `"P1"` \| `"P2"` \| `"P3"`

Defined in: [src/collector/types.ts:72](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L72)

Inferred priority

***

### source

> `readonly` **source**: `string`

Defined in: [src/collector/types.ts:74](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L74)

Source reference where this was found

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/collector/types.ts:76](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L76)

Confidence score (0.0 - 1.0)

***

### isFunctional

> `readonly` **isFunctional**: `boolean`

Defined in: [src/collector/types.ts:78](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L78)

Whether this is a functional requirement

***

### nfrCategory?

> `readonly` `optional` **nfrCategory**: `"security"` \| `"performance"` \| `"scalability"` \| `"usability"` \| `"reliability"` \| `"maintainability"`

Defined in: [src/collector/types.ts:80](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L80)

Category for non-functional requirements

***

### acceptanceCriteria?

> `readonly` `optional` **acceptanceCriteria**: readonly `string`[]

Defined in: [src/collector/types.ts:88](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L88)

Extracted acceptance criteria for this requirement
