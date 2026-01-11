[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CommandSanitizer

# Class: CommandSanitizer

Defined in: [src/security/CommandSanitizer.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L47)

CommandSanitizer - Validates and executes commands safely

This class provides secure command execution by:
1. Validating commands against a whitelist
2. Sanitizing arguments to prevent injection
3. Using execFile instead of exec (bypasses shell)

## Constructors

### Constructor

> **new CommandSanitizer**(`options`): `CommandSanitizer`

Defined in: [src/security/CommandSanitizer.ts:52](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L52)

#### Parameters

##### options

[`CommandSanitizerOptions`](../interfaces/CommandSanitizerOptions.md) = `{}`

#### Returns

`CommandSanitizer`

## Methods

### validateCommand()

> **validateCommand**(`baseCommand`, `args`): [`SanitizedCommand`](../interfaces/SanitizedCommand.md)

Defined in: [src/security/CommandSanitizer.ts:68](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L68)

Validate and sanitize a command before execution

#### Parameters

##### baseCommand

`string`

The base command (e.g., 'git', 'npm')

##### args

`string`[]

Command arguments

#### Returns

[`SanitizedCommand`](../interfaces/SanitizedCommand.md)

Sanitized command object

#### Throws

CommandNotAllowedError if command is not whitelisted

#### Throws

CommandInjectionError if injection is detected

***

### sanitizeArgument()

> **sanitizeArgument**(`arg`, `command?`): `string`

Defined in: [src/security/CommandSanitizer.ts:122](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L122)

Sanitize a single argument

#### Parameters

##### arg

`string`

The argument to sanitize

##### command?

`string`

The base command (for context-specific validation)

#### Returns

`string`

Sanitized argument

#### Throws

CommandInjectionError if dangerous characters are detected in strict mode

***

### escapeForParser()

> **escapeForParser**(`content`): `string`

Defined in: [src/security/CommandSanitizer.ts:170](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L170)

Escape content for use within double quotes in command strings
Escapes backslashes and double quotes for parseCommandString compatibility

#### Parameters

##### content

`string`

The content to escape

#### Returns

`string`

Escaped content safe for use in double-quoted command arguments

#### Example

```ts
// Usage: `gh pr create --title "${sanitizer.escapeForParser(title)}"`
```

***

### ~~escapeForShell()~~

> **escapeForShell**(`arg`): `string`

Defined in: [src/security/CommandSanitizer.ts:183](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L183)

Escape a single argument for shell use
Wraps in single quotes and escapes internal single quotes

#### Parameters

##### arg

`string`

The argument to escape

#### Returns

`string`

Escaped argument safe for shell use

#### Deprecated

Use escapeForParser() for execFromString, or use array-based methods (execGit, execGh)

***

### safeExec()

> **safeExec**(`command`, `options`): `Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Defined in: [src/security/CommandSanitizer.ts:197](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L197)

Execute a command safely using execFile (no shell)

#### Parameters

##### command

[`SanitizedCommand`](../interfaces/SanitizedCommand.md)

Sanitized command object

##### options

`ExecFileOptions` = `{}`

Execution options

#### Returns

`Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Command execution result

***

### exec()

> **exec**(`baseCommand`, `args`, `options`): `Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Defined in: [src/security/CommandSanitizer.ts:258](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L258)

Validate and execute a command in one step

#### Parameters

##### baseCommand

`string`

The base command

##### args

`string`[]

Command arguments

##### options

`ExecFileOptions` = `{}`

Execution options

#### Returns

`Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Command execution result

***

### execGit()

> **execGit**(`args`, `options`): `Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Defined in: [src/security/CommandSanitizer.ts:274](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L274)

Execute a git command safely

#### Parameters

##### args

`string`[]

Git command arguments (e.g., ['status', '--porcelain'])

##### options

`ExecFileOptions` = `{}`

Execution options

#### Returns

`Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Command execution result

***

### execGh()

> **execGh**(`args`, `options`): `Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Defined in: [src/security/CommandSanitizer.ts:285](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L285)

Execute a GitHub CLI command safely

#### Parameters

##### args

`string`[]

gh command arguments (e.g., ['pr', 'list'])

##### options

`ExecFileOptions` = `{}`

Execution options

#### Returns

`Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Command execution result

***

### execNpm()

> **execNpm**(`args`, `options`): `Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Defined in: [src/security/CommandSanitizer.ts:296](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L296)

Execute an npm command safely

#### Parameters

##### args

`string`[]

npm command arguments (e.g., ['install', '--save-dev'])

##### options

`ExecFileOptions` = `{}`

Execution options

#### Returns

`Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Command execution result

***

### safeExecSync()

> **safeExecSync**(`command`, `options`): [`CommandExecResult`](../interfaces/CommandExecResult.md)

Defined in: [src/security/CommandSanitizer.ts:307](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L307)

Execute a command synchronously using execFileSync (no shell)

#### Parameters

##### command

[`SanitizedCommand`](../interfaces/SanitizedCommand.md)

Sanitized command object

##### options

`ExecFileSyncOptions` = `{}`

Execution options

#### Returns

[`CommandExecResult`](../interfaces/CommandExecResult.md)

Command execution result

***

### execSync()

> **execSync**(`baseCommand`, `args`, `options`): [`CommandExecResult`](../interfaces/CommandExecResult.md)

Defined in: [src/security/CommandSanitizer.ts:366](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L366)

Validate and execute a command synchronously

#### Parameters

##### baseCommand

`string`

The base command

##### args

`string`[]

Command arguments

##### options

`ExecFileSyncOptions` = `{}`

Execution options

#### Returns

[`CommandExecResult`](../interfaces/CommandExecResult.md)

Command execution result

***

### execGitSync()

> **execGitSync**(`args`, `options`): [`CommandExecResult`](../interfaces/CommandExecResult.md)

Defined in: [src/security/CommandSanitizer.ts:382](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L382)

Execute a git command synchronously

#### Parameters

##### args

`string`[]

Git command arguments

##### options

`ExecFileSyncOptions` = `{}`

Execution options

#### Returns

[`CommandExecResult`](../interfaces/CommandExecResult.md)

Command execution result

***

### execGhSync()

> **execGhSync**(`args`, `options`): [`CommandExecResult`](../interfaces/CommandExecResult.md)

Defined in: [src/security/CommandSanitizer.ts:393](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L393)

Execute a GitHub CLI command synchronously

#### Parameters

##### args

`string`[]

gh command arguments

##### options

`ExecFileSyncOptions` = `{}`

Execution options

#### Returns

[`CommandExecResult`](../interfaces/CommandExecResult.md)

Command execution result

***

### isAllowed()

> **isAllowed**(`command`): `boolean`

Defined in: [src/security/CommandSanitizer.ts:403](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L403)

Check if a command is allowed

#### Parameters

##### command

`string`

The command to check

#### Returns

`boolean`

True if the command is allowed

***

### parseCommandString()

> **parseCommandString**(`commandString`): `object`

Defined in: [src/security/CommandSanitizer.ts:414](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L414)

Parse a command string into base command and arguments
Handles basic quoting and shell redirections

#### Parameters

##### commandString

`string`

Full command string (e.g., "git status --porcelain")

#### Returns

`object`

Parsed command and arguments

##### command

> **command**: `string`

##### args

> **args**: `string`[]

***

### execFromString()

> **execFromString**(`commandString`, `options`): `Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Defined in: [src/security/CommandSanitizer.ts:468](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L468)

Execute a command from a string (for migration compatibility)
Parses the command string and executes safely

#### Parameters

##### commandString

`string`

Full command string (e.g., "gh pr view 123 --json url")

##### options

`ExecFileOptions` = `{}`

Execution options

#### Returns

`Promise`\<[`CommandExecResult`](../interfaces/CommandExecResult.md)\>

Command execution result

***

### execFromStringSync()

> **execFromStringSync**(`commandString`, `options`): [`CommandExecResult`](../interfaces/CommandExecResult.md)

Defined in: [src/security/CommandSanitizer.ts:494](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L494)

Execute a command from a string synchronously

#### Parameters

##### commandString

`string`

Full command string

##### options

`ExecFileSyncOptions` = `{}`

Execution options

#### Returns

[`CommandExecResult`](../interfaces/CommandExecResult.md)

Command execution result

***

### validateConfigCommand()

> **validateConfigCommand**(`commandString`): `object`

Defined in: [src/security/CommandSanitizer.ts:531](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/CommandSanitizer.ts#L531)

Validate a config-based command (from workflow.yaml etc.)
This is more permissive but still checks for obvious injection

#### Parameters

##### commandString

`string`

Command string from configuration

#### Returns

`object`

Validation result

##### valid

> **valid**: `boolean`

##### reason?

> `optional` **reason**: `string`

##### parsed?

> `optional` **parsed**: `object`

###### parsed.command

> **command**: `string`

###### parsed.args

> **args**: `string`[]
