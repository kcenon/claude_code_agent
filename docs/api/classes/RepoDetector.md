[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RepoDetector

# Class: RepoDetector

Defined in: [src/repo-detector/RepoDetector.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/RepoDetector.ts#L44)

Repository Detector Agent

Analyzes project Git and GitHub state to determine repository mode.

## Constructors

### Constructor

> **new RepoDetector**(`config`): `RepoDetector`

Defined in: [src/repo-detector/RepoDetector.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/RepoDetector.ts#L48)

#### Parameters

##### config

[`RepoDetectorConfig`](../interfaces/RepoDetectorConfig.md) = `{}`

#### Returns

`RepoDetector`

## Methods

### startSession()

> **startSession**(`projectId`, `rootPath`): [`RepoDetectionSession`](../interfaces/RepoDetectionSession.md)

Defined in: [src/repo-detector/RepoDetector.ts:70](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/RepoDetector.ts#L70)

Start a new detection session

#### Parameters

##### projectId

`string`

##### rootPath

`string`

#### Returns

[`RepoDetectionSession`](../interfaces/RepoDetectionSession.md)

***

### getSession()

> **getSession**(): [`RepoDetectionSession`](../interfaces/RepoDetectionSession.md) \| `null`

Defined in: [src/repo-detector/RepoDetector.ts:90](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/RepoDetector.ts#L90)

Get current session

#### Returns

[`RepoDetectionSession`](../interfaces/RepoDetectionSession.md) \| `null`

***

### detect()

> **detect**(): `Promise`\<[`RepoDetectionResult`](../interfaces/RepoDetectionResult.md)\>

Defined in: [src/repo-detector/RepoDetector.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/repo-detector/RepoDetector.ts#L97)

Detect repository mode for the current session

#### Returns

`Promise`\<[`RepoDetectionResult`](../interfaces/RepoDetectionResult.md)\>
