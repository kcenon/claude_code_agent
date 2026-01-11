[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ResolvedPath

# Interface: ResolvedPath

Defined in: [src/security/PathResolver.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L30)

Result of path resolution

## Properties

### absolutePath

> `readonly` **absolutePath**: `string`

Defined in: [src/security/PathResolver.ts:32](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L32)

The resolved absolute path

***

### originalPath

> `readonly` **originalPath**: `string`

Defined in: [src/security/PathResolver.ts:34](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L34)

The original input path

***

### isWithinProjectRoot

> `readonly` **isWithinProjectRoot**: `boolean`

Defined in: [src/security/PathResolver.ts:36](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L36)

Whether the path is within project root

***

### isInAllowedExternal

> `readonly` **isInAllowedExternal**: `boolean`

Defined in: [src/security/PathResolver.ts:38](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L38)

Whether the path is in an allowed external directory
