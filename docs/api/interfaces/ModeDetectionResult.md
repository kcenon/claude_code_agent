[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ModeDetectionResult

# Interface: ModeDetectionResult

Defined in: [src/mode-detector/types.ts:111](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L111)

Mode detection result

## Properties

### selectedMode

> `readonly` **selectedMode**: [`PipelineMode`](../type-aliases/PipelineMode.md)

Defined in: [src/mode-detector/types.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L113)

Selected pipeline mode

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/mode-detector/types.ts:115](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L115)

Detection confidence (0.0 to 1.0)

***

### confidenceLevel

> `readonly` **confidenceLevel**: [`ConfidenceLevel`](../type-aliases/ConfidenceLevel.md)

Defined in: [src/mode-detector/types.ts:117](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L117)

Confidence level classification

***

### evidence

> `readonly` **evidence**: [`DetectionEvidence`](DetectionEvidence.md)

Defined in: [src/mode-detector/types.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L119)

Detection evidence

***

### scores

> `readonly` **scores**: [`DetectionScores`](DetectionScores.md)

Defined in: [src/mode-detector/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L121)

Score breakdown

***

### reasoning

> `readonly` **reasoning**: `string`

Defined in: [src/mode-detector/types.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L123)

Human-readable reasoning

***

### recommendations

> `readonly` **recommendations**: readonly `string`[]

Defined in: [src/mode-detector/types.ts:125](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L125)

Recommendations for the user
