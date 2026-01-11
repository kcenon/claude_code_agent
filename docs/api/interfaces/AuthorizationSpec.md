[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AuthorizationSpec

# Interface: AuthorizationSpec

Defined in: [src/sds-writer/types.ts:505](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L505)

Authorization specification

## Properties

### model

> `readonly` **model**: `"none"` \| `"rbac"` \| `"abac"` \| `"acl"`

Defined in: [src/sds-writer/types.ts:507](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L507)

Authorization model

***

### roles?

> `readonly` `optional` **roles**: readonly [`RoleDefinition`](RoleDefinition.md)[]

Defined in: [src/sds-writer/types.ts:509](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L509)

Roles (for RBAC)

***

### permissions?

> `readonly` `optional` **permissions**: readonly [`PermissionRule`](PermissionRule.md)[]

Defined in: [src/sds-writer/types.ts:511](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L511)

Permission rules
