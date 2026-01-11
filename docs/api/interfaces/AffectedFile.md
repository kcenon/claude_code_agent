[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AffectedFile

# Interface: AffectedFile

Defined in: [src/impact-analyzer/types.ts:107](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L107)

Affected file information

## Properties

### path

> `readonly` **path**: `string`

Defined in: [src/impact-analyzer/types.ts:109](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L109)

File path relative to project root

***

### changeType

> `readonly` **changeType**: [`FileChangeType`](../type-aliases/FileChangeType.md)

Defined in: [src/impact-analyzer/types.ts:111](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L111)

Type of change expected

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/impact-analyzer/types.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L113)

Confidence in the prediction (0.0 - 1.0)

***

### reason

> `readonly` **reason**: `string`

Defined in: [src/impact-analyzer/types.ts:115](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L115)

Reason for including this file
