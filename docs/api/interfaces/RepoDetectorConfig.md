[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RepoDetectorConfig

# Interface: RepoDetectorConfig

Defined in: [src/repo-detector/types.ts:157](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L157)

Repository Detector configuration

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/repo-detector/types.ts:159](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L159)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### timeouts?

> `readonly` `optional` **timeouts**: [`TimeoutConfig`](TimeoutConfig.md)

Defined in: [src/repo-detector/types.ts:161](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L161)

Timeout configuration

***

### github?

> `readonly` `optional` **github**: [`GitHubConfig`](GitHubConfig.md)

Defined in: [src/repo-detector/types.ts:163](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L163)

GitHub configuration

***

### detection?

> `readonly` `optional` **detection**: [`DetectionConfig`](DetectionConfig.md)

Defined in: [src/repo-detector/types.ts:165](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/types.ts#L165)

Detection configuration
