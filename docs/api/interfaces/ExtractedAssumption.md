[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ExtractedAssumption

# Interface: ExtractedAssumption

Defined in: [src/collector/types.ts:112](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L112)

Extracted assumption from input

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/collector/types.ts:114](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L114)

Generated assumption ID (e.g., ASM-001)

***

### description

> `readonly` **description**: `string`

Defined in: [src/collector/types.ts:116](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L116)

Assumption description

***

### riskIfWrong?

> `readonly` `optional` **riskIfWrong**: `string`

Defined in: [src/collector/types.ts:118](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L118)

Risk if the assumption is wrong

***

### source

> `readonly` **source**: `string`

Defined in: [src/collector/types.ts:120](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L120)

Source reference

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/collector/types.ts:122](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L122)

Confidence score (0.0 - 1.0)
