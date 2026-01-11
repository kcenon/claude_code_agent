[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ParallelGroup

# Interface: ParallelGroup

Defined in: [src/issue-generator/types.ts:298](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L298)

Group of issues that can be executed in parallel

## Properties

### groupIndex

> `readonly` **groupIndex**: `number`

Defined in: [src/issue-generator/types.ts:300](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L300)

Group index (execution order)

***

### issueIds

> `readonly` **issueIds**: readonly `string`[]

Defined in: [src/issue-generator/types.ts:302](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L302)

Issue IDs in this group
