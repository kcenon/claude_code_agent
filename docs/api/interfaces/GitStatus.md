[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GitStatus

# Interface: GitStatus

Defined in: [src/repo-detector/types.ts:31](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L31)

Git initialization status

## Properties

### initialized

> `readonly` **initialized**: `boolean`

Defined in: [src/repo-detector/types.ts:33](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L33)

Whether .git directory exists

***

### hasCommits

> `readonly` **hasCommits**: `boolean`

Defined in: [src/repo-detector/types.ts:35](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L35)

Whether repository has any commits

***

### currentBranch

> `readonly` **currentBranch**: `string` \| `null`

Defined in: [src/repo-detector/types.ts:37](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L37)

Current branch name

***

### isClean

> `readonly` **isClean**: `boolean`

Defined in: [src/repo-detector/types.ts:39](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L39)

Whether working directory is clean
