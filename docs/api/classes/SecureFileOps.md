[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SecureFileOps

# Class: SecureFileOps

Defined in: [src/security/SecureFileOps.ts:85](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L85)

Centralized secure file operations wrapper

All file operations are validated against the project root to prevent
path traversal attacks. Operations are optionally logged for audit.

## Constructors

### Constructor

> **new SecureFileOps**(`config`): `SecureFileOps`

Defined in: [src/security/SecureFileOps.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L93)

#### Parameters

##### config

[`SecureFileOpsConfig`](../interfaces/SecureFileOpsConfig.md)

#### Returns

`SecureFileOps`

## Methods

### validatePath()

> **validatePath**(`relativePath`): `string`

Defined in: [src/security/SecureFileOps.ts:116](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L116)

Validate and resolve a file path

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`string`

Absolute validated path

#### Throws

PathTraversalError if path escapes project root

***

### isValidPath()

> **isValidPath**(`relativePath`): `boolean`

Defined in: [src/security/SecureFileOps.ts:127](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L127)

Validate path without throwing

#### Parameters

##### relativePath

`string`

Path to validate

#### Returns

`boolean`

True if path is valid

***

### writeFile()

> **writeFile**(`relativePath`, `content`, `options`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileOps.ts:143](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L143)

Write file with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

##### content

Content to write

`string` | `Buffer`\<`ArrayBufferLike`\>

##### options

[`WriteOptions`](../interfaces/WriteOptions.md) = `{}`

Write options

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### writeFileSync()

> **writeFileSync**(`relativePath`, `content`, `options`): `void`

Defined in: [src/security/SecureFileOps.ts:169](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L169)

Write file synchronously with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

##### content

Content to write

`string` | `Buffer`\<`ArrayBufferLike`\>

##### options

[`WriteOptions`](../interfaces/WriteOptions.md) = `{}`

Write options

#### Returns

`void`

#### Throws

PathTraversalError if path escapes project root

***

### readFile()

> **readFile**(`relativePath`, `options`): `Promise`\<`string`\>

Defined in: [src/security/SecureFileOps.ts:199](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L199)

Read file with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

##### options

`ReadOptions` = `{}`

Read options

#### Returns

`Promise`\<`string`\>

File content

#### Throws

PathTraversalError if path escapes project root

***

### readFileSync()

> **readFileSync**(`relativePath`, `options`): `string`

Defined in: [src/security/SecureFileOps.ts:218](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L218)

Read file synchronously with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

##### options

`ReadOptions` = `{}`

Read options

#### Returns

`string`

File content

#### Throws

PathTraversalError if path escapes project root

***

### readFileBuffer()

> **readFileBuffer**(`relativePath`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [src/security/SecureFileOps.ts:236](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L236)

Read file as buffer with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

File content as buffer

#### Throws

PathTraversalError if path escapes project root

***

### appendFile()

> **appendFile**(`relativePath`, `content`, `options`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileOps.ts:253](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L253)

Append to file with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

##### content

Content to append

`string` | `Buffer`\<`ArrayBufferLike`\>

##### options

[`WriteOptions`](../interfaces/WriteOptions.md) = `{}`

Write options

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### appendFileSync()

> **appendFileSync**(`relativePath`, `content`, `options`): `void`

Defined in: [src/security/SecureFileOps.ts:279](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L279)

Append to file synchronously with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

##### content

Content to append

`string` | `Buffer`\<`ArrayBufferLike`\>

##### options

[`WriteOptions`](../interfaces/WriteOptions.md) = `{}`

Write options

#### Returns

`void`

#### Throws

PathTraversalError if path escapes project root

***

### mkdir()

> **mkdir**(`relativePath`, `options`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileOps.ts:308](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L308)

Create directory with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

##### options

[`MkdirOptions`](../interfaces/MkdirOptions.md) = `{}`

Mkdir options

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### mkdirSync()

> **mkdirSync**(`relativePath`, `options`): `void`

Defined in: [src/security/SecureFileOps.ts:324](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L324)

Create directory synchronously with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

##### options

[`MkdirOptions`](../interfaces/MkdirOptions.md) = `{}`

Mkdir options

#### Returns

`void`

#### Throws

PathTraversalError if path escapes project root

***

### readdir()

> **readdir**(`relativePath`): `Promise`\<`string`[]\>

Defined in: [src/security/SecureFileOps.ts:340](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L340)

Read directory contents with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`Promise`\<`string`[]\>

Directory entries

#### Throws

PathTraversalError if path escapes project root

***

### readdirWithTypes()

> **readdirWithTypes**(`relativePath`): `Promise`\<`Dirent`\<`string`\>[]\>

Defined in: [src/security/SecureFileOps.ts:352](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L352)

Read directory contents with file types

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`Promise`\<`Dirent`\<`string`\>[]\>

Directory entries with file type information

#### Throws

PathTraversalError if path escapes project root

***

### unlink()

> **unlink**(`relativePath`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileOps.ts:367](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L367)

Delete file with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### unlinkSync()

> **unlinkSync**(`relativePath`): `void`

Defined in: [src/security/SecureFileOps.ts:381](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L381)

Delete file synchronously with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`void`

#### Throws

PathTraversalError if path escapes project root

***

### rm()

> **rm**(`relativePath`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileOps.ts:395](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L395)

Remove file or directory recursively with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if path escapes project root

***

### exists()

> **exists**(`relativePath`): `Promise`\<`boolean`\>

Defined in: [src/security/SecureFileOps.ts:414](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L414)

Check if path exists with validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`Promise`\<`boolean`\>

True if path exists

#### Throws

PathTraversalError if path escapes project root

***

### existsSync()

> **existsSync**(`relativePath`): `boolean`

Defined in: [src/security/SecureFileOps.ts:432](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L432)

Check if path exists synchronously with validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`boolean`

True if path exists

#### Throws

PathTraversalError if path escapes project root

***

### stat()

> **stat**(`relativePath`): `Promise`\<`Stats`\>

Defined in: [src/security/SecureFileOps.ts:450](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L450)

Get file stats with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`Promise`\<`Stats`\>

File stats

#### Throws

PathTraversalError if path escapes project root

***

### statSync()

> **statSync**(`relativePath`): `Stats`

Defined in: [src/security/SecureFileOps.ts:462](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L462)

Get file stats synchronously with path validation

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`Stats`

File stats

#### Throws

PathTraversalError if path escapes project root

***

### rename()

> **rename**(`oldPath`, `newPath`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileOps.ts:478](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L478)

Rename/move file with path validation

#### Parameters

##### oldPath

`string`

Current path relative to project root

##### newPath

`string`

New path relative to project root

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if either path escapes project root

***

### renameSync()

> **renameSync**(`oldPath`, `newPath`): `void`

Defined in: [src/security/SecureFileOps.ts:494](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L494)

Rename/move file synchronously with path validation

#### Parameters

##### oldPath

`string`

Current path relative to project root

##### newPath

`string`

New path relative to project root

#### Returns

`void`

#### Throws

PathTraversalError if either path escapes project root

***

### copyFile()

> **copyFile**(`srcPath`, `destPath`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileOps.ts:514](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L514)

Copy file with path validation

#### Parameters

##### srcPath

`string`

Source path relative to project root

##### destPath

`string`

Destination path relative to project root

#### Returns

`Promise`\<`void`\>

#### Throws

PathTraversalError if either path escapes project root

***

### getProjectRoot()

> **getProjectRoot**(): `string`

Defined in: [src/security/SecureFileOps.ts:534](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L534)

Get the project root path

#### Returns

`string`

***

### getAbsolutePath()

> **getAbsolutePath**(`relativePath`): `string`

Defined in: [src/security/SecureFileOps.ts:545](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L545)

Get absolute path for a relative path (with validation)

#### Parameters

##### relativePath

`string`

Path relative to project root

#### Returns

`string`

Absolute path

#### Throws

PathTraversalError if path escapes project root

***

### getRelativePath()

> **getRelativePath**(`absolutePath`): `string`

Defined in: [src/security/SecureFileOps.ts:555](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L555)

Get relative path from absolute path

#### Parameters

##### absolutePath

`string`

Absolute path

#### Returns

`string`

Path relative to project root

***

### join()

> **join**(...`segments`): `string`

Defined in: [src/security/SecureFileOps.ts:566](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileOps.ts#L566)

Join path segments and validate

#### Parameters

##### segments

...`string`[]

Path segments to join

#### Returns

`string`

Validated absolute path

#### Throws

PathTraversalError if result escapes project root
