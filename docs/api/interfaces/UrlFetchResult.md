[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / UrlFetchResult

# Interface: UrlFetchResult

Defined in: [src/collector/types.ts:304](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L304)

URL fetch result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/collector/types.ts:306](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L306)

Whether fetch was successful

***

### content

> `readonly` **content**: `string`

Defined in: [src/collector/types.ts:308](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L308)

Fetched and processed content

***

### url

> `readonly` **url**: `string`

Defined in: [src/collector/types.ts:310](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L310)

Original URL

***

### finalUrl?

> `readonly` `optional` **finalUrl**: `string`

Defined in: [src/collector/types.ts:312](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L312)

Final URL after redirects

***

### title?

> `readonly` `optional` **title**: `string`

Defined in: [src/collector/types.ts:314](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L314)

Page title if available

***

### error?

> `readonly` `optional` **error**: `string`

Defined in: [src/collector/types.ts:316](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L316)

Any errors during fetch
