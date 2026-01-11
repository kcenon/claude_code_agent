[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SecureFileHandler

# Class: SecureFileHandler

Defined in: [src/security/SecureFileHandler.ts:35](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L35)

Handles secure file operations with auto-cleanup

## Constructors

### Constructor

> **new SecureFileHandler**(`options`): `SecureFileHandler`

Defined in: [src/security/SecureFileHandler.ts:42](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L42)

#### Parameters

##### options

[`SecureFileHandlerOptions`](../interfaces/SecureFileHandlerOptions.md) = `{}`

#### Returns

`SecureFileHandler`

## Methods

### createTempDir()

> **createTempDir**(): `Promise`\<`string`\>

Defined in: [src/security/SecureFileHandler.ts:82](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L82)

Create a secure temporary directory

#### Returns

`Promise`\<`string`\>

Path to the created temporary directory

***

### createTempDirSync()

> **createTempDirSync**(): `string`

Defined in: [src/security/SecureFileHandler.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L97)

Create a secure temporary directory (synchronous)

#### Returns

`string`

Path to the created temporary directory

***

### createTempFile()

> **createTempFile**(`content`, `extension`): `Promise`\<`string`\>

Defined in: [src/security/SecureFileHandler.ts:111](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L111)

Create a secure temporary file with content

#### Parameters

##### content

`string`

The content to write to the file

##### extension

`string` = `'.txt'`

Optional file extension (e.g., '.txt')

#### Returns

`Promise`\<`string`\>

Path to the created temporary file

***

### createTempFileSync()

> **createTempFileSync**(`content`, `extension`): `string`

Defined in: [src/security/SecureFileHandler.ts:131](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L131)

Create a secure temporary file with content (synchronous)

#### Parameters

##### content

`string`

The content to write to the file

##### extension

`string` = `'.txt'`

Optional file extension

#### Returns

`string`

Path to the created temporary file

***

### writeSecure()

> **writeSecure**(`filePath`, `content`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileHandler.ts:150](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L150)

Write content to a file with secure permissions

#### Parameters

##### filePath

`string`

Path to the file

##### content

`string`

Content to write

#### Returns

`Promise`\<`void`\>

***

### writeSecureSync()

> **writeSecureSync**(`filePath`, `content`): `void`

Defined in: [src/security/SecureFileHandler.ts:168](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L168)

Write content to a file with secure permissions (synchronous)

#### Parameters

##### filePath

`string`

Path to the file

##### content

`string`

Content to write

#### Returns

`void`

***

### readSecure()

> **readSecure**(`filePath`): `Promise`\<`string`\>

Defined in: [src/security/SecureFileHandler.ts:183](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L183)

Read a file securely (verifies permissions first)

#### Parameters

##### filePath

`string`

Path to the file

#### Returns

`Promise`\<`string`\>

File content

***

### deleteSecure()

> **deleteSecure**(`targetPath`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileHandler.ts:200](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L200)

Delete a file or directory securely

#### Parameters

##### targetPath

`string`

Path to delete

#### Returns

`Promise`\<`void`\>

***

### deleteSecureSync()

> **deleteSecureSync**(`targetPath`): `void`

Defined in: [src/security/SecureFileHandler.ts:217](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L217)

Delete a file or directory securely (synchronous)

#### Parameters

##### targetPath

`string`

Path to delete

#### Returns

`void`

***

### cleanupAll()

> **cleanupAll**(): `Promise`\<`void`\>

Defined in: [src/security/SecureFileHandler.ts:236](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L236)

Clean up all tracked temporary files and directories

#### Returns

`Promise`\<`void`\>

***

### cleanupAllSync()

> **cleanupAllSync**(): `void`

Defined in: [src/security/SecureFileHandler.ts:253](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L253)

Clean up all tracked temporary files and directories (synchronous)

#### Returns

`void`

***

### isTracked()

> **isTracked**(`targetPath`): `boolean`

Defined in: [src/security/SecureFileHandler.ts:265](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L265)

Check if a path is tracked for cleanup

#### Parameters

##### targetPath

`string`

Path to check

#### Returns

`boolean`

***

### getTrackedCount()

> **getTrackedCount**(): `number`

Defined in: [src/security/SecureFileHandler.ts:272](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L272)

Get count of tracked paths

#### Returns

`number`

***

### track()

> **track**(`targetPath`): `void`

Defined in: [src/security/SecureFileHandler.ts:281](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L281)

Manually track a path for cleanup

#### Parameters

##### targetPath

`string`

Path to track

#### Returns

`void`

***

### untrack()

> **untrack**(`targetPath`): `void`

Defined in: [src/security/SecureFileHandler.ts:290](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L290)

Remove a path from tracking without deleting it

#### Parameters

##### targetPath

`string`

Path to untrack

#### Returns

`void`

***

### copySecure()

> **copySecure**(`source`, `destination`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileHandler.ts:300](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L300)

Copy a file securely with proper permissions

#### Parameters

##### source

`string`

Source file path

##### destination

`string`

Destination file path

#### Returns

`Promise`\<`void`\>

***

### moveSecure()

> **moveSecure**(`source`, `destination`): `Promise`\<`void`\>

Defined in: [src/security/SecureFileHandler.ts:314](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L314)

Move a file securely

#### Parameters

##### source

`string`

Source file path

##### destination

`string`

Destination file path

#### Returns

`Promise`\<`void`\>

***

### exists()

> **exists**(`filePath`): `Promise`\<`boolean`\>

Defined in: [src/security/SecureFileHandler.ts:329](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L329)

Check if a file exists and is accessible

#### Parameters

##### filePath

`string`

Path to check

#### Returns

`Promise`\<`boolean`\>

***

### getSecureStats()

> **getSecureStats**(`filePath`): `Promise`\<\{ `size`: `number`; `mode`: `number`; `isSecure`: `boolean`; `warnings`: `string`[]; \}\>

Defined in: [src/security/SecureFileHandler.ts:344](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecureFileHandler.ts#L344)

Get file stats with security info

#### Parameters

##### filePath

`string`

Path to the file

#### Returns

`Promise`\<\{ `size`: `number`; `mode`: `number`; `isSecure`: `boolean`; `warnings`: `string`[]; \}\>

Object with file stats and security info
