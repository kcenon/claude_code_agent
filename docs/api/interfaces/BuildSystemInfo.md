[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / BuildSystemInfo

# Interface: BuildSystemInfo

Defined in: [src/codebase-analyzer/types.ts:253](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L253)

Build system information

## Properties

### type

> `readonly` **type**: [`BuildSystemType`](../type-aliases/BuildSystemType.md)

Defined in: [src/codebase-analyzer/types.ts:255](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L255)

Build system type

***

### version?

> `readonly` `optional` **version**: `string`

Defined in: [src/codebase-analyzer/types.ts:257](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L257)

Version if detectable

***

### scripts

> `readonly` **scripts**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:259](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L259)

Available scripts/targets

***

### hasLockFile

> `readonly` **hasLockFile**: `boolean`

Defined in: [src/codebase-analyzer/types.ts:261](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L261)

Lock file present
