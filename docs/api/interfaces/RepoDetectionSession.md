[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RepoDetectionSession

# Interface: RepoDetectionSession

Defined in: [src/repo-detector/types.ts:107](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L107)

Repository detection session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/repo-detector/types.ts:109](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L109)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/repo-detector/types.ts:111](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L111)

Project identifier

***

### status

> `readonly` **status**: [`RepoDetectionStatus`](../type-aliases/RepoDetectionStatus.md)

Defined in: [src/repo-detector/types.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L113)

Session status

***

### rootPath

> `readonly` **rootPath**: `string`

Defined in: [src/repo-detector/types.ts:115](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L115)

Project root path

***

### result

> `readonly` **result**: [`RepoDetectionResult`](RepoDetectionResult.md) \| `null`

Defined in: [src/repo-detector/types.ts:117](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L117)

Detection result (if completed)

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/repo-detector/types.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L119)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/repo-detector/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L121)

Session last update time

***

### errors

> `readonly` **errors**: readonly `string`[]

Defined in: [src/repo-detector/types.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L123)

Any errors during detection
