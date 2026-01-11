[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / isAllowedSubcommand

# Function: isAllowedSubcommand()

> **isAllowedSubcommand**(`command`, `subcommand`, `config`): `boolean`

Defined in: [src/security/CommandWhitelist.ts:241](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L241)

Check if a subcommand is allowed for a given command

## Parameters

### command

`string`

The base command

### subcommand

`string`

The subcommand to check

### config

[`CommandWhitelistConfig`](../type-aliases/CommandWhitelistConfig.md) = `DEFAULT_COMMAND_WHITELIST`

Optional custom whitelist configuration

## Returns

`boolean`

True if the subcommand is allowed
