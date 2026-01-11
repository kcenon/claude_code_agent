[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DetectionThresholds

# Interface: DetectionThresholds

Defined in: [src/mode-detector/types.ts:193](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L193)

Threshold configuration

## Properties

### enhancementThreshold

> `readonly` **enhancementThreshold**: `number`

Defined in: [src/mode-detector/types.ts:195](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L195)

Score threshold for enhancement mode (>= this = enhancement)

***

### greenfieldThreshold

> `readonly` **greenfieldThreshold**: `number`

Defined in: [src/mode-detector/types.ts:197](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L197)

Score threshold for greenfield mode (<= this = greenfield)

***

### minSourceFiles

> `readonly` **minSourceFiles**: `number`

Defined in: [src/mode-detector/types.ts:199](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L199)

Minimum source files to consider codebase as existing

***

### minLinesOfCode

> `readonly` **minLinesOfCode**: `number`

Defined in: [src/mode-detector/types.ts:201](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L201)

Minimum lines of code to consider codebase as substantial
