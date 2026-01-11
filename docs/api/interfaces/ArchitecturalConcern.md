[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ArchitecturalConcern

# Interface: ArchitecturalConcern

Defined in: [src/architecture-generator/types.ts:196](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L196)

Architectural concern identified during analysis

## Properties

### category

> `readonly` **category**: [`NFRCategory`](../type-aliases/NFRCategory.md)

Defined in: [src/architecture-generator/types.ts:198](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L198)

Concern category

***

### description

> `readonly` **description**: `string`

Defined in: [src/architecture-generator/types.ts:200](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L200)

Concern description

***

### mitigation

> `readonly` **mitigation**: `string`

Defined in: [src/architecture-generator/types.ts:202](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L202)

Suggested mitigation

***

### priority

> `readonly` **priority**: `"low"` \| `"medium"` \| `"high"`

Defined in: [src/architecture-generator/types.ts:204](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/architecture-generator/types.ts#L204)

Priority level
