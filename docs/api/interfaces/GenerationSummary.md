[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GenerationSummary

# Interface: GenerationSummary

Defined in: [src/issue-generator/types.ts:320](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L320)

Generation summary statistics

## Properties

### totalIssues

> `readonly` **totalIssues**: `number`

Defined in: [src/issue-generator/types.ts:322](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L322)

Total issues generated

***

### byPriority

> `readonly` **byPriority**: `Record`\<[`Priority`](../type-aliases/Priority.md), `number`\>

Defined in: [src/issue-generator/types.ts:324](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L324)

Issues by priority

***

### byType

> `readonly` **byType**: `Record`\<[`IssueType`](../type-aliases/IssueType.md), `number`\>

Defined in: [src/issue-generator/types.ts:326](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L326)

Issues by type

***

### bySize

> `readonly` **bySize**: `Record`\<[`EffortSize`](../type-aliases/EffortSize.md), `number`\>

Defined in: [src/issue-generator/types.ts:328](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L328)

Issues by size

***

### totalEstimatedHours

> `readonly` **totalEstimatedHours**: `number`

Defined in: [src/issue-generator/types.ts:330](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L330)

Total estimated hours

***

### componentsProcessed

> `readonly` **componentsProcessed**: `number`

Defined in: [src/issue-generator/types.ts:332](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L332)

Components processed

***

### generatedAt

> `readonly` **generatedAt**: `string`

Defined in: [src/issue-generator/types.ts:334](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L334)

Generation timestamp

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/issue-generator/types.ts:336](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L336)

Warnings during generation
