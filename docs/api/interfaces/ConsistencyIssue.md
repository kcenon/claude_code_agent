[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ConsistencyIssue

# Interface: ConsistencyIssue

Defined in: [src/prd-writer/types.ts:103](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L103)

Consistency issue item

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/prd-writer/types.ts:105](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L105)

Unique identifier for the issue

***

### type

> `readonly` **type**: [`ConsistencyIssueType`](../type-aliases/ConsistencyIssueType.md)

Defined in: [src/prd-writer/types.ts:107](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L107)

Type of consistency issue

***

### severity

> `readonly` **severity**: [`GapSeverity`](../type-aliases/GapSeverity.md)

Defined in: [src/prd-writer/types.ts:109](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L109)

Severity level

***

### description

> `readonly` **description**: `string`

Defined in: [src/prd-writer/types.ts:111](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L111)

Description of the issue

***

### relatedIds

> `readonly` **relatedIds**: readonly `string`[]

Defined in: [src/prd-writer/types.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L113)

Related requirement IDs

***

### suggestion

> `readonly` **suggestion**: `string`

Defined in: [src/prd-writer/types.ts:115](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L115)

Suggested resolution
