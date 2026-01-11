[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InputParserOptions

# Interface: InputParserOptions

Defined in: [src/collector/InputParser.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L51)

InputParser options

## Properties

### maxFileSize?

> `readonly` `optional` **maxFileSize**: `number`

Defined in: [src/collector/InputParser.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L53)

Maximum file size in bytes (default: 10MB)

***

### urlTimeout?

> `readonly` `optional` **urlTimeout**: `number`

Defined in: [src/collector/InputParser.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L55)

URL fetch timeout in milliseconds (default: 30000)

***

### followRedirects?

> `readonly` `optional` **followRedirects**: `boolean`

Defined in: [src/collector/InputParser.ts:57](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/InputParser.ts#L57)

Whether to follow redirects (default: true)
