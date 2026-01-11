[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SecretManagerOptions

# Interface: SecretManagerOptions

Defined in: [src/security/types.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L58)

Secret manager configuration options

## Properties

### envFilePath?

> `readonly` `optional` **envFilePath**: `string`

Defined in: [src/security/types.ts:60](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L60)

Path to .env file (default: .env)

***

### requiredSecrets?

> `readonly` `optional` **requiredSecrets**: readonly `string`[]

Defined in: [src/security/types.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L62)

Required secret keys that must be present

***

### throwOnMissing?

> `readonly` `optional` **throwOnMissing**: `boolean`

Defined in: [src/security/types.ts:64](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/types.ts#L64)

Whether to throw on missing required secrets
