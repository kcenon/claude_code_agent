[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CollectorAgentConfig

# Interface: CollectorAgentConfig

Defined in: [src/collector/types.ts:228](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L228)

Collector Agent configuration options

## Properties

### confidenceThreshold?

> `readonly` `optional` **confidenceThreshold**: `number`

Defined in: [src/collector/types.ts:230](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L230)

Minimum confidence threshold for auto-accepting extractions

***

### maxQuestionsPerRound?

> `readonly` `optional` **maxQuestionsPerRound**: `number`

Defined in: [src/collector/types.ts:232](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L232)

Maximum number of clarification questions to ask at once

***

### skipClarificationIfConfident?

> `readonly` `optional` **skipClarificationIfConfident**: `boolean`

Defined in: [src/collector/types.ts:234](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L234)

Whether to skip clarification for high-confidence extractions

***

### defaultPriority?

> `readonly` `optional` **defaultPriority**: `"P0"` \| `"P1"` \| `"P2"` \| `"P3"`

Defined in: [src/collector/types.ts:236](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L236)

Default priority for requirements without explicit priority

***

### detectLanguage?

> `readonly` `optional` **detectLanguage**: `boolean`

Defined in: [src/collector/types.ts:238](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L238)

Enable automatic language detection

***

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/collector/types.ts:240](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L240)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)
