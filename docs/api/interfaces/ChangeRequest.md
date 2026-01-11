[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ChangeRequest

# Interface: ChangeRequest

Defined in: [src/impact-analyzer/types.ts:253](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L253)

Change request input

## Properties

### description

> `readonly` **description**: `string`

Defined in: [src/impact-analyzer/types.ts:255](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L255)

Description of the requested change

***

### context?

> `readonly` `optional` **context**: `string`

Defined in: [src/impact-analyzer/types.ts:257](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L257)

Additional context for the change

***

### targetFiles?

> `readonly` `optional` **targetFiles**: readonly `string`[]

Defined in: [src/impact-analyzer/types.ts:259](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L259)

Specific files mentioned

***

### targetComponents?

> `readonly` `optional` **targetComponents**: readonly `string`[]

Defined in: [src/impact-analyzer/types.ts:261](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L261)

Specific components mentioned

***

### priority?

> `readonly` `optional` **priority**: `string`

Defined in: [src/impact-analyzer/types.ts:263](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L263)

Priority of the change
