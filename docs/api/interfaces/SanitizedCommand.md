[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SanitizedCommand

# Interface: SanitizedCommand

Defined in: [src/security/types.ts:156](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L156)

Sanitized command ready for safe execution

## Properties

### baseCommand

> `readonly` **baseCommand**: `string`

Defined in: [src/security/types.ts:158](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L158)

Base command (e.g., 'git', 'npm')

***

### subCommand?

> `readonly` `optional` **subCommand**: `string`

Defined in: [src/security/types.ts:160](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L160)

Subcommand if any (e.g., 'status', 'install')

***

### args

> `readonly` **args**: `string`[]

Defined in: [src/security/types.ts:162](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L162)

Sanitized arguments array

***

### rawCommand

> `readonly` **rawCommand**: `string`

Defined in: [src/security/types.ts:164](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L164)

Raw command string for logging (do not execute directly)
