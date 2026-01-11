[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / IssueGenerationResult

# Interface: IssueGenerationResult

Defined in: [src/issue-generator/types.ts:308](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L308)

Issue generation result

## Properties

### issues

> `readonly` **issues**: readonly [`GeneratedIssue`](GeneratedIssue.md)[]

Defined in: [src/issue-generator/types.ts:310](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L310)

Generated issues

***

### dependencyGraph

> `readonly` **dependencyGraph**: `DependencyGraph`

Defined in: [src/issue-generator/types.ts:312](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L312)

Dependency graph

***

### summary

> `readonly` **summary**: [`GenerationSummary`](GenerationSummary.md)

Defined in: [src/issue-generator/types.ts:314](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L314)

Generation summary
