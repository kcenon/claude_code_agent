[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CommandConfig

# Interface: CommandConfig

Defined in: [src/security/CommandWhitelist.ts:16](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L16)

Configuration for a single allowed command

## Properties

### allowed

> `readonly` **allowed**: `boolean`

Defined in: [src/security/CommandWhitelist.ts:18](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L18)

Whether this command is allowed

***

### subcommands?

> `readonly` `optional` **subcommands**: readonly `string`[]

Defined in: [src/security/CommandWhitelist.ts:20](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L20)

Allowed subcommands (if any)

***

### argPatterns?

> `readonly` `optional` **argPatterns**: `Record`\<`string`, [`ArgPattern`](../type-aliases/ArgPattern.md)\>

Defined in: [src/security/CommandWhitelist.ts:22](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L22)

Argument validation patterns by position or name

***

### maxArgs?

> `readonly` `optional` **maxArgs**: `number`

Defined in: [src/security/CommandWhitelist.ts:24](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L24)

Maximum number of arguments allowed

***

### allowArbitraryArgs?

> `readonly` `optional` **allowArbitraryArgs**: `boolean`

Defined in: [src/security/CommandWhitelist.ts:26](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L26)

Whether to allow arbitrary arguments (use with caution)
