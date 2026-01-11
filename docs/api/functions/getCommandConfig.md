[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / getCommandConfig

# Function: getCommandConfig()

> **getCommandConfig**(`command`, `config`): [`CommandConfig`](../interfaces/CommandConfig.md) \| `undefined`

Defined in: [src/security/CommandWhitelist.ts:266](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandWhitelist.ts#L266)

Get the configuration for a specific command

## Parameters

### command

`string`

The command to get configuration for

### config

[`CommandWhitelistConfig`](../type-aliases/CommandWhitelistConfig.md) = `DEFAULT_COMMAND_WHITELIST`

Optional custom whitelist configuration

## Returns

[`CommandConfig`](../interfaces/CommandConfig.md) \| `undefined`

The command configuration or undefined if not found
