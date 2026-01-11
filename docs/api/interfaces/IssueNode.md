[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / IssueNode

# Interface: IssueNode

Defined in: [src/controller/types.ts:45](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L45)

Issue node in the dependency graph

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/controller/types.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L47)

Unique issue identifier

***

### title

> `readonly` **title**: `string`

Defined in: [src/controller/types.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L49)

Issue title

***

### priority

> `readonly` **priority**: [`ControllerPriority`](../type-aliases/ControllerPriority.md)

Defined in: [src/controller/types.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L51)

Priority level

***

### effort

> `readonly` **effort**: `number`

Defined in: [src/controller/types.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L53)

Estimated effort in hours

***

### status

> `readonly` **status**: [`IssueStatus`](../type-aliases/IssueStatus.md)

Defined in: [src/controller/types.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L55)

Issue status

***

### url?

> `readonly` `optional` **url**: `string`

Defined in: [src/controller/types.ts:57](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L57)

GitHub issue URL (optional)

***

### componentId?

> `readonly` `optional` **componentId**: `string`

Defined in: [src/controller/types.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L59)

Component ID reference
