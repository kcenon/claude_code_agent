[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PrerequisiteCheck

# Interface: PrerequisiteCheck

Defined in: [src/init/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L95)

Prerequisite check definition

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/init/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L97)

Display name for the check

***

### check()

> `readonly` **check**: () => `Promise`\<`boolean`\>

Defined in: [src/init/types.ts:100](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L100)

Function to perform the check

#### Returns

`Promise`\<`boolean`\>

***

### fix

> `readonly` **fix**: `string`

Defined in: [src/init/types.ts:103](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L103)

Instructions to fix if check fails

***

### required

> `readonly` **required**: `boolean`

Defined in: [src/init/types.ts:106](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L106)

Whether this check is required (fails init) or optional (warning only)
