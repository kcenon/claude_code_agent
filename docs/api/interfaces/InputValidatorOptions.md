[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InputValidatorOptions

# Interface: InputValidatorOptions

Defined in: [src/security/types.ts:70](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L70)

Input validator configuration options

## Properties

### basePath

> `readonly` **basePath**: `string`

Defined in: [src/security/types.ts:72](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L72)

Base path for file path validation

***

### allowedProtocols?

> `readonly` `optional` **allowedProtocols**: readonly `string`[]

Defined in: [src/security/types.ts:74](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L74)

Allowed URL protocols (default: ['https:'])

***

### blockInternalUrls?

> `readonly` `optional` **blockInternalUrls**: `boolean`

Defined in: [src/security/types.ts:76](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L76)

Block internal/localhost URLs (default: true)

***

### maxInputLength?

> `readonly` `optional` **maxInputLength**: `number`

Defined in: [src/security/types.ts:78](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L78)

Maximum input length (default: 10000)
