[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ModeDetector

# Class: ModeDetector

Defined in: [src/mode-detector/ModeDetector.ts:42](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/ModeDetector.ts#L42)

Mode Detector Agent

Analyzes project state to determine the appropriate pipeline mode.

## Constructors

### Constructor

> **new ModeDetector**(`config`): `ModeDetector`

Defined in: [src/mode-detector/ModeDetector.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/ModeDetector.ts#L46)

#### Parameters

##### config

[`ModeDetectorConfig`](../interfaces/ModeDetectorConfig.md) = `{}`

#### Returns

`ModeDetector`

## Methods

### startSession()

> **startSession**(`projectId`, `rootPath`, `userInput`): [`ModeDetectionSession`](../interfaces/ModeDetectionSession.md)

Defined in: [src/mode-detector/ModeDetector.ts:68](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/ModeDetector.ts#L68)

Start a new detection session

#### Parameters

##### projectId

`string`

##### rootPath

`string`

##### userInput

`string` = `''`

#### Returns

[`ModeDetectionSession`](../interfaces/ModeDetectionSession.md)

***

### getSession()

> **getSession**(): [`ModeDetectionSession`](../interfaces/ModeDetectionSession.md) \| `null`

Defined in: [src/mode-detector/ModeDetector.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/ModeDetector.ts#L93)

Get current session

#### Returns

[`ModeDetectionSession`](../interfaces/ModeDetectionSession.md) \| `null`

***

### detect()

> **detect**(`userOverrideMode?`): `Promise`\<[`ModeDetectionResult`](../interfaces/ModeDetectionResult.md)\>

Defined in: [src/mode-detector/ModeDetector.ts:100](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/ModeDetector.ts#L100)

Detect pipeline mode for the current session

#### Parameters

##### userOverrideMode?

[`PipelineMode`](../type-aliases/PipelineMode.md)

#### Returns

`Promise`\<[`ModeDetectionResult`](../interfaces/ModeDetectionResult.md)\>
