[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PathResolverOptions

# Interface: PathResolverOptions

Defined in: [src/security/PathResolver.ts:18](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L18)

Configuration options for PathResolver

## Properties

### projectRoot

> `readonly` **projectRoot**: `string`

Defined in: [src/security/PathResolver.ts:20](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L20)

Project root directory (all paths relative to this)

***

### allowedExternalDirs?

> `readonly` `optional` **allowedExternalDirs**: readonly `string`[]

Defined in: [src/security/PathResolver.ts:22](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L22)

Additional allowed directories outside project root

***

### validateSymlinks?

> `readonly` `optional` **validateSymlinks**: `boolean`

Defined in: [src/security/PathResolver.ts:24](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L24)

Follow symbolic links and validate targets (default: true)
