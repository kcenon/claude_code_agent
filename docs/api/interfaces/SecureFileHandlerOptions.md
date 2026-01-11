[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SecureFileHandlerOptions

# Interface: SecureFileHandlerOptions

Defined in: [src/security/types.ts:84](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L84)

Secure file handler configuration options

## Properties

### tempPrefix?

> `readonly` `optional` **tempPrefix**: `string`

Defined in: [src/security/types.ts:86](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L86)

Temporary file prefix

***

### autoCleanup?

> `readonly` `optional` **autoCleanup**: `boolean`

Defined in: [src/security/types.ts:88](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L88)

Auto-cleanup on process exit (default: true)

***

### fileMode?

> `readonly` `optional` **fileMode**: `number`

Defined in: [src/security/types.ts:90](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L90)

File permission mode (default: 0o600)
