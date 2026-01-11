[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ModeDetectorConfig

# Interface: ModeDetectorConfig

Defined in: [src/mode-detector/types.ts:207](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L207)

Mode Detector configuration

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/mode-detector/types.ts:209](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L209)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### docsBasePath?

> `readonly` `optional` **docsBasePath**: `string`

Defined in: [src/mode-detector/types.ts:211](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L211)

Documents base path (defaults to docs)

***

### rules?

> `readonly` `optional` **rules**: readonly [`DetectionRule`](DetectionRule.md)[]

Defined in: [src/mode-detector/types.ts:213](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L213)

Detection rules

***

### keywords?

> `readonly` `optional` **keywords**: [`KeywordConfig`](KeywordConfig.md)

Defined in: [src/mode-detector/types.ts:215](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L215)

Keyword configuration

***

### weights?

> `readonly` `optional` **weights**: [`ScoreWeights`](ScoreWeights.md)

Defined in: [src/mode-detector/types.ts:217](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L217)

Score weights

***

### thresholds?

> `readonly` `optional` **thresholds**: [`DetectionThresholds`](DetectionThresholds.md)

Defined in: [src/mode-detector/types.ts:219](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L219)

Detection thresholds
