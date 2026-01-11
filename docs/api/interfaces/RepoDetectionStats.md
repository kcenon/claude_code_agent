[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RepoDetectionStats

# Interface: RepoDetectionStats

Defined in: [src/repo-detector/types.ts:204](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L204)

Detection statistics

## Properties

### gitCheckTimeMs

> `readonly` **gitCheckTimeMs**: `number`

Defined in: [src/repo-detector/types.ts:206](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L206)

Time spent on git status check (ms)

***

### remoteCheckTimeMs

> `readonly` **remoteCheckTimeMs**: `number`

Defined in: [src/repo-detector/types.ts:208](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L208)

Time spent on remote check (ms)

***

### githubCheckTimeMs

> `readonly` **githubCheckTimeMs**: `number`

Defined in: [src/repo-detector/types.ts:210](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L210)

Time spent on GitHub check (ms)

***

### totalTimeMs

> `readonly` **totalTimeMs**: `number`

Defined in: [src/repo-detector/types.ts:212](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L212)

Total detection time (ms)
