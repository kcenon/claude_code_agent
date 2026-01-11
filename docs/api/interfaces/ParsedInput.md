[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ParsedInput

# Interface: ParsedInput

Defined in: [src/collector/types.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L50)

Parsed input from various sources

## Properties

### sources

> `readonly` **sources**: readonly [`InputSource`](InputSource.md)[]

Defined in: [src/collector/types.ts:52](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L52)

Original input sources

***

### combinedContent

> `readonly` **combinedContent**: `string`

Defined in: [src/collector/types.ts:54](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L54)

Combined text content

***

### detectedLanguage?

> `readonly` `optional` **detectedLanguage**: `string`

Defined in: [src/collector/types.ts:56](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L56)

Detected language (e.g., 'en', 'ko')

***

### wordCount

> `readonly` **wordCount**: `number`

Defined in: [src/collector/types.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L58)

Word count of combined content
