[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AuditLoggerOptions

# Interface: AuditLoggerOptions

Defined in: [src/security/types.ts:96](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L96)

Audit logger configuration options

## Properties

### logDir?

> `readonly` `optional` **logDir**: `string`

Defined in: [src/security/types.ts:98](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L98)

Log output directory

***

### maxFileSize?

> `readonly` `optional` **maxFileSize**: `number`

Defined in: [src/security/types.ts:100](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L100)

Maximum log file size in bytes

***

### maxFiles?

> `readonly` `optional` **maxFiles**: `number`

Defined in: [src/security/types.ts:102](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L102)

Maximum number of log files to keep

***

### consoleOutput?

> `readonly` `optional` **consoleOutput**: `boolean`

Defined in: [src/security/types.ts:104](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L104)

Enable console output (default: false in production)
