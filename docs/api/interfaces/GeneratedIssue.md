[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GeneratedIssue

# Interface: GeneratedIssue

Defined in: [src/issue-generator/types.ts:140](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L140)

Generated GitHub issue structure

## Properties

### issueId

> `readonly` **issueId**: `string`

Defined in: [src/issue-generator/types.ts:142](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L142)

Internal issue identifier

***

### githubNumber

> `readonly` **githubNumber**: `number` \| `null`

Defined in: [src/issue-generator/types.ts:144](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L144)

GitHub issue number (filled after creation)

***

### title

> `readonly` **title**: `string`

Defined in: [src/issue-generator/types.ts:146](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L146)

Issue title

***

### body

> `readonly` **body**: `string`

Defined in: [src/issue-generator/types.ts:148](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L148)

Issue body in markdown

***

### labels

> `readonly` **labels**: [`IssueLabels`](IssueLabels.md)

Defined in: [src/issue-generator/types.ts:150](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L150)

Issue labels

***

### milestone

> `readonly` **milestone**: `string` \| `null`

Defined in: [src/issue-generator/types.ts:152](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L152)

Milestone name

***

### assignees

> `readonly` **assignees**: readonly `string`[]

Defined in: [src/issue-generator/types.ts:154](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L154)

Assignees (may be empty)

***

### dependencies

> `readonly` **dependencies**: [`IssueDependencies`](IssueDependencies.md)

Defined in: [src/issue-generator/types.ts:156](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L156)

Dependency relationships

***

### traceability

> `readonly` **traceability**: [`IssueTraceability`](IssueTraceability.md)

Defined in: [src/issue-generator/types.ts:158](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L158)

Traceability links

***

### technical

> `readonly` **technical**: [`IssueTechnical`](IssueTechnical.md)

Defined in: [src/issue-generator/types.ts:160](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L160)

Technical guidance

***

### estimation

> `readonly` **estimation**: [`IssueEstimation`](IssueEstimation.md)

Defined in: [src/issue-generator/types.ts:162](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L162)

Effort estimation
