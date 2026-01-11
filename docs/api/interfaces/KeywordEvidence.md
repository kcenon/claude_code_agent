[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / KeywordEvidence

# Interface: KeywordEvidence

Defined in: [src/mode-detector/types.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L61)

Keyword analysis evidence

## Properties

### greenfieldKeywords

> `readonly` **greenfieldKeywords**: readonly `string`[]

Defined in: [src/mode-detector/types.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L63)

Keywords that indicate greenfield mode

***

### enhancementKeywords

> `readonly` **enhancementKeywords**: readonly `string`[]

Defined in: [src/mode-detector/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L65)

Keywords that indicate enhancement mode

***

### signalStrength

> `readonly` **signalStrength**: `number`

Defined in: [src/mode-detector/types.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L67)

Overall keyword signal strength (-1.0 to 1.0)
