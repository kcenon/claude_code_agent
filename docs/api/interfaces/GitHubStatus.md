[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GitHubStatus

# Interface: GitHubStatus

Defined in: [src/repo-detector/types.ts:57](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L57)

GitHub repository status

## Properties

### exists

> `readonly` **exists**: `boolean`

Defined in: [src/repo-detector/types.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L59)

Whether GitHub repository exists

***

### accessible

> `readonly` **accessible**: `boolean`

Defined in: [src/repo-detector/types.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L61)

Whether repository is accessible

***

### owner

> `readonly` **owner**: `string` \| `null`

Defined in: [src/repo-detector/types.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L63)

Repository owner

***

### name

> `readonly` **name**: `string` \| `null`

Defined in: [src/repo-detector/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L65)

Repository name

***

### url

> `readonly` **url**: `string` \| `null`

Defined in: [src/repo-detector/types.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L67)

Full repository URL

***

### visibility

> `readonly` **visibility**: [`RepositoryVisibility`](../type-aliases/RepositoryVisibility.md)

Defined in: [src/repo-detector/types.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L69)

Repository visibility

***

### defaultBranch

> `readonly` **defaultBranch**: `string` \| `null`

Defined in: [src/repo-detector/types.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L71)

Default branch name
