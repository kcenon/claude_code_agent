[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CriticalPath

# Interface: CriticalPath

Defined in: [src/controller/types.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L119)

Critical path information

## Properties

### path

> `readonly` **path**: readonly `string`[]

Defined in: [src/controller/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L121)

Ordered list of issue IDs on the critical path

***

### totalDuration

> `readonly` **totalDuration**: `number`

Defined in: [src/controller/types.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L123)

Total duration of the critical path

***

### bottleneck

> `readonly` **bottleneck**: `string` \| `null`

Defined in: [src/controller/types.ts:125](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L125)

Bottleneck issue (highest effort on path)
