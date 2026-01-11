[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DirectoryEntry

# Interface: DirectoryEntry

Defined in: [src/architecture-generator/types.ts:302](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L302)

Directory entry (file or folder)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/architecture-generator/types.ts:304](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L304)

Entry name

***

### type

> `readonly` **type**: `"file"` \| `"directory"`

Defined in: [src/architecture-generator/types.ts:306](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L306)

Entry type

***

### description

> `readonly` **description**: `string`

Defined in: [src/architecture-generator/types.ts:308](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L308)

Entry description

***

### children

> `readonly` **children**: readonly `DirectoryEntry`[]

Defined in: [src/architecture-generator/types.ts:310](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L310)

Child entries (for directories)
