[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PathResolver

# Class: PathResolver

Defined in: [src/security/PathResolver.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L44)

Project-aware path resolver with security validation

## Constructors

### Constructor

> **new PathResolver**(`options`): `PathResolver`

Defined in: [src/security/PathResolver.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L49)

#### Parameters

##### options

[`PathResolverOptions`](../interfaces/PathResolverOptions.md)

#### Returns

`PathResolver`

## Methods

### resolve()

> **resolve**(`inputPath`): [`ResolvedPath`](../interfaces/ResolvedPath.md)

Defined in: [src/security/PathResolver.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L62)

Resolve and validate a file path

#### Parameters

##### inputPath

`string`

The path to resolve (relative or absolute)

#### Returns

[`ResolvedPath`](../interfaces/ResolvedPath.md)

Resolved path information

#### Throws

PathTraversalError if path escapes allowed directories

***

### resolveSafe()

> **resolveSafe**(`inputPath`): [`ResolvedPath`](../interfaces/ResolvedPath.md) \| `null`

Defined in: [src/security/PathResolver.ts:98](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L98)

Resolve path without throwing (returns null if invalid)

#### Parameters

##### inputPath

`string`

The path to resolve

#### Returns

[`ResolvedPath`](../interfaces/ResolvedPath.md) \| `null`

Resolved path or null if validation fails

***

### isValid()

> **isValid**(`inputPath`): `boolean`

Defined in: [src/security/PathResolver.ts:112](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L112)

Validate that a path is safe without resolving

#### Parameters

##### inputPath

`string`

The path to validate

#### Returns

`boolean`

True if path would be valid

***

### resolveWithSymlinkCheck()

> **resolveWithSymlinkCheck**(`inputPath`): `Promise`\<[`ResolvedPath`](../interfaces/ResolvedPath.md)\>

Defined in: [src/security/PathResolver.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L123)

Resolve path and validate symbolic link target if applicable

#### Parameters

##### inputPath

`string`

The path to resolve

#### Returns

`Promise`\<[`ResolvedPath`](../interfaces/ResolvedPath.md)\>

Resolved path with symlink validation

#### Throws

PathTraversalError if symlink target escapes allowed directories

***

### getProjectRoot()

> **getProjectRoot**(): `string`

Defined in: [src/security/PathResolver.ts:175](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L175)

Get the configured project root

#### Returns

`string`

***

### getAllowedExternalDirs()

> **getAllowedExternalDirs**(): readonly `string`[]

Defined in: [src/security/PathResolver.ts:182](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L182)

Get allowed external directories

#### Returns

readonly `string`[]

***

### join()

> **join**(...`segments`): [`ResolvedPath`](../interfaces/ResolvedPath.md)

Defined in: [src/security/PathResolver.ts:193](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L193)

Join paths safely within the project root

#### Parameters

##### segments

...`string`[]

Path segments to join

#### Returns

[`ResolvedPath`](../interfaces/ResolvedPath.md)

Resolved path

#### Throws

PathTraversalError if result escapes allowed directories

***

### relativeTo()

> **relativeTo**(`absolutePath`): `string`

Defined in: [src/security/PathResolver.ts:204](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/PathResolver.ts#L204)

Get the relative path from project root

#### Parameters

##### absolutePath

`string`

Absolute path

#### Returns

`string`

Relative path from project root
