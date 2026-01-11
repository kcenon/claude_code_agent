[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CommandExecResult

# Interface: CommandExecResult

Defined in: [src/security/types.ts:170](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L170)

Result of command execution

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/security/types.ts:172](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L172)

Whether command succeeded (exit code 0)

***

### stdout

> `readonly` **stdout**: `string`

Defined in: [src/security/types.ts:174](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L174)

Standard output

***

### stderr

> `readonly` **stderr**: `string`

Defined in: [src/security/types.ts:176](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L176)

Standard error

***

### command

> `readonly` **command**: `string`

Defined in: [src/security/types.ts:178](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L178)

Full command string (for logging)

***

### duration

> `readonly` **duration**: `number`

Defined in: [src/security/types.ts:180](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L180)

Execution duration in milliseconds

***

### exitCode?

> `readonly` `optional` **exitCode**: `number`

Defined in: [src/security/types.ts:182](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L182)

Exit code if available
