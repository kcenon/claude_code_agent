[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / WriteOptions

# Interface: WriteOptions

Defined in: [src/security/SecureFileOps.ts:42](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L42)

Options for write operations

## Properties

### encoding?

> `readonly` `optional` **encoding**: `BufferEncoding`

Defined in: [src/security/SecureFileOps.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L44)

File encoding (default: 'utf-8')

***

### mode?

> `readonly` `optional` **mode**: `number`

Defined in: [src/security/SecureFileOps.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L46)

File permission mode

***

### createDirs?

> `readonly` `optional` **createDirs**: `boolean`

Defined in: [src/security/SecureFileOps.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L48)

Create parent directories if needed (default: true)
