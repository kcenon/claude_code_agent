[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RepoDetectionResult

# Interface: RepoDetectionResult

Defined in: [src/repo-detector/types.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L87)

Repository detection result

## Properties

### mode

> `readonly` **mode**: [`RepositoryMode`](../type-aliases/RepositoryMode.md)

Defined in: [src/repo-detector/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L89)

Detected repository mode

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/repo-detector/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L91)

Detection confidence (0.0 to 1.0)

***

### gitStatus

> `readonly` **gitStatus**: [`GitStatus`](GitStatus.md)

Defined in: [src/repo-detector/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L93)

Git status information

***

### remoteStatus

> `readonly` **remoteStatus**: [`RemoteStatus`](RemoteStatus.md)

Defined in: [src/repo-detector/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L95)

Remote configuration status

***

### githubStatus

> `readonly` **githubStatus**: [`GitHubStatus`](GitHubStatus.md)

Defined in: [src/repo-detector/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L97)

GitHub repository status

***

### recommendation

> `readonly` **recommendation**: [`DetectionRecommendation`](DetectionRecommendation.md)

Defined in: [src/repo-detector/types.ts:99](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L99)

Recommendation for pipeline

***

### detectedAt

> `readonly` **detectedAt**: `string`

Defined in: [src/repo-detector/types.ts:101](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L101)

Detection timestamp
