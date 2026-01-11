[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / IssueGeneratorOptions

# Interface: IssueGeneratorOptions

Defined in: [src/issue-generator/types.ts:342](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L342)

Issue generator configuration options

## Properties

### maxIssueSize?

> `readonly` `optional` **maxIssueSize**: [`EffortSize`](../type-aliases/EffortSize.md)

Defined in: [src/issue-generator/types.ts:344](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L344)

Maximum issue size before decomposition

***

### defaultPriority?

> `readonly` `optional` **defaultPriority**: [`Priority`](../type-aliases/Priority.md)

Defined in: [src/issue-generator/types.ts:346](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L346)

Default priority for issues

***

### defaultType?

> `readonly` `optional` **defaultType**: [`IssueType`](../type-aliases/IssueType.md)

Defined in: [src/issue-generator/types.ts:348](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L348)

Default issue type

***

### milestone?

> `readonly` `optional` **milestone**: `string`

Defined in: [src/issue-generator/types.ts:350](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L350)

Project milestone

***

### phasePrefix?

> `readonly` `optional` **phasePrefix**: `string`

Defined in: [src/issue-generator/types.ts:352](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L352)

Phase label prefix

***

### includeHints?

> `readonly` `optional` **includeHints**: `boolean`

Defined in: [src/issue-generator/types.ts:354](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L354)

Include implementation hints

***

### includeTraceability?

> `readonly` `optional` **includeTraceability**: `boolean`

Defined in: [src/issue-generator/types.ts:356](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L356)

Include traceability links
