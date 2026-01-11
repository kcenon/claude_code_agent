[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DetectionScores

# Interface: DetectionScores

Defined in: [src/mode-detector/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L97)

Detection score breakdown

## Properties

### documentScore

> `readonly` **documentScore**: `number`

Defined in: [src/mode-detector/types.ts:99](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L99)

Score from document analysis (0.0 to 1.0, 1.0 = enhancement)

***

### codebaseScore

> `readonly` **codebaseScore**: `number`

Defined in: [src/mode-detector/types.ts:101](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L101)

Score from codebase analysis (0.0 to 1.0, 1.0 = enhancement)

***

### keywordScore

> `readonly` **keywordScore**: `number`

Defined in: [src/mode-detector/types.ts:103](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L103)

Score from keyword analysis (0.0 to 1.0, 1.0 = enhancement)

***

### finalScore

> `readonly` **finalScore**: `number`

Defined in: [src/mode-detector/types.ts:105](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L105)

Final weighted score (0.0 to 1.0, 1.0 = enhancement)
