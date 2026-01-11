[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ClarificationQuestion

# Interface: ClarificationQuestion

Defined in: [src/collector/types.ts:146](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L146)

Clarification question for unclear information

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/collector/types.ts:148](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L148)

Generated question ID (e.g., Q-001)

***

### category

> `readonly` **category**: [`ClarificationCategory`](../type-aliases/ClarificationCategory.md)

Defined in: [src/collector/types.ts:150](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L150)

Category of the question

***

### question

> `readonly` **question**: `string`

Defined in: [src/collector/types.ts:152](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L152)

The question to ask

***

### context

> `readonly` **context**: `string`

Defined in: [src/collector/types.ts:154](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L154)

Context explaining why this question is needed

***

### options?

> `readonly` `optional` **options**: readonly `string`[]

Defined in: [src/collector/types.ts:156](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L156)

Optional predefined answer choices

***

### required

> `readonly` **required**: `boolean`

Defined in: [src/collector/types.ts:158](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L158)

Whether this question is blocking

***

### relatedTo?

> `readonly` `optional` **relatedTo**: `string`

Defined in: [src/collector/types.ts:160](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L160)

Related extraction that triggered this question
