[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ArchitectureNFR

# Interface: ArchitectureNFR

Defined in: [src/architecture-generator/types.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L119)

Non-functional requirement definition

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/architecture-generator/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L121)

NFR identifier

***

### category

> `readonly` **category**: [`NFRCategory`](../type-aliases/NFRCategory.md)

Defined in: [src/architecture-generator/types.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L123)

NFR category

***

### description

> `readonly` **description**: `string`

Defined in: [src/architecture-generator/types.ts:125](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L125)

Requirement description

***

### target

> `readonly` **target**: `string`

Defined in: [src/architecture-generator/types.ts:127](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L127)

Measurable target

***

### priority

> `readonly` **priority**: `"P0"` \| `"P1"` \| `"P2"` \| `"P3"`

Defined in: [src/architecture-generator/types.ts:129](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L129)

Priority level
