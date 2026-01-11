[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SecureFileOpsConfig

# Interface: SecureFileOpsConfig

Defined in: [src/security/SecureFileOps.ts:24](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L24)

Configuration options for SecureFileOps

## Properties

### projectRoot

> `readonly` **projectRoot**: `string`

Defined in: [src/security/SecureFileOps.ts:26](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L26)

Project root directory (all paths relative to this)

***

### allowedExternalDirs?

> `readonly` `optional` **allowedExternalDirs**: readonly `string`[]

Defined in: [src/security/SecureFileOps.ts:28](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L28)

Additional allowed directories outside project root

***

### enableAuditLog?

> `readonly` `optional` **enableAuditLog**: `boolean`

Defined in: [src/security/SecureFileOps.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L30)

Enable audit logging for file operations

***

### actor?

> `readonly` `optional` **actor**: `string`

Defined in: [src/security/SecureFileOps.ts:32](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L32)

Actor name for audit logging

***

### fileMode?

> `readonly` `optional` **fileMode**: `number`

Defined in: [src/security/SecureFileOps.ts:34](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L34)

File permission mode (default: 0o600)

***

### dirMode?

> `readonly` `optional` **dirMode**: `number`

Defined in: [src/security/SecureFileOps.ts:36](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L36)

Directory permission mode (default: 0o700)
