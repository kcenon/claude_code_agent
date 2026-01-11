[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PrerequisiteResult

# Interface: PrerequisiteResult

Defined in: [src/init/types.ts:112](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L112)

Result of prerequisite validation

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/init/types.ts:114](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L114)

Name of the prerequisite

***

### passed

> `readonly` **passed**: `boolean`

Defined in: [src/init/types.ts:117](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L117)

Whether the check passed

***

### fix?

> `readonly` `optional` **fix**: `string`

Defined in: [src/init/types.ts:120](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L120)

Fix instruction if check failed

***

### required

> `readonly` **required**: `boolean`

Defined in: [src/init/types.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L123)

Whether this was a required check
