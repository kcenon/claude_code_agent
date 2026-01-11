[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RemoteStatus

# Interface: RemoteStatus

Defined in: [src/repo-detector/types.ts:45](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L45)

Remote repository status

## Properties

### configured

> `readonly` **configured**: `boolean`

Defined in: [src/repo-detector/types.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L47)

Whether remote origin is configured

***

### originUrl

> `readonly` **originUrl**: `string` \| `null`

Defined in: [src/repo-detector/types.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L49)

Origin URL

***

### remoteType

> `readonly` **remoteType**: [`RemoteType`](../type-aliases/RemoteType.md)

Defined in: [src/repo-detector/types.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L51)

Type of remote (GitHub, GitLab, etc.)
