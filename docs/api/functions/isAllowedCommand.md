[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / isAllowedCommand

# Function: isAllowedCommand()

> **isAllowedCommand**(`command`, `config`): `boolean`

Defined in: [src/security/CommandWhitelist.ts:225](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L225)

Check if a command is in the whitelist

## Parameters

### command

`string`

The base command to check

### config

[`CommandWhitelistConfig`](../type-aliases/CommandWhitelistConfig.md) = `DEFAULT_COMMAND_WHITELIST`

Optional custom whitelist configuration

## Returns

`boolean`

True if the command is allowed
