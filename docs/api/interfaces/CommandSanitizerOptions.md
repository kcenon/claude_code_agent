[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CommandSanitizerOptions

# Interface: CommandSanitizerOptions

Defined in: [src/security/types.ts:144](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L144)

Command sanitizer configuration options

## Properties

### whitelist?

> `readonly` `optional` **whitelist**: `Record`\<`string`, `unknown`\>

Defined in: [src/security/types.ts:146](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L146)

Custom command whitelist (overrides default)

***

### strictMode?

> `readonly` `optional` **strictMode**: `boolean`

Defined in: [src/security/types.ts:148](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L148)

Enable strict mode (reject any shell metacharacters)

***

### logCommands?

> `readonly` `optional` **logCommands**: `boolean`

Defined in: [src/security/types.ts:150](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L150)

Enable command logging
