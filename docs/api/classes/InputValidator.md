[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InputValidator

# Class: InputValidator

Defined in: [src/security/InputValidator.ts:42](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L42)

Validates and sanitizes user inputs

## Constructors

### Constructor

> **new InputValidator**(`options`): `InputValidator`

Defined in: [src/security/InputValidator.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L48)

#### Parameters

##### options

[`InputValidatorOptions`](../interfaces/InputValidatorOptions.md)

#### Returns

`InputValidator`

## Methods

### validateFilePath()

> **validateFilePath**(`inputPath`): `string`

Defined in: [src/security/InputValidator.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L63)

Validate and normalize a file path
Prevents path traversal attacks

#### Parameters

##### inputPath

`string`

The path to validate

#### Returns

`string`

The validated and resolved absolute path

#### Throws

PathTraversalError if path traversal is detected

***

### validateFilePathSafe()

> **validateFilePathSafe**(`inputPath`): `ValidationResult`

Defined in: [src/security/InputValidator.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L87)

Validate a file path and return a result object

#### Parameters

##### inputPath

`string`

The path to validate

#### Returns

`ValidationResult`

Validation result with valid flag and normalized value or error

***

### validateUrl()

> **validateUrl**(`urlString`): `URL`

Defined in: [src/security/InputValidator.ts:106](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L106)

Validate a URL

#### Parameters

##### urlString

`string`

The URL to validate

#### Returns

`URL`

The validated URL object

#### Throws

InvalidUrlError if validation fails

***

### validateUrlSafe()

> **validateUrlSafe**(`urlString`): `ValidationResult`

Defined in: [src/security/InputValidator.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L137)

Validate a URL and return a result object

#### Parameters

##### urlString

`string`

The URL to validate

#### Returns

`ValidationResult`

Validation result with valid flag and normalized value or error

***

### sanitizeUserInput()

> **sanitizeUserInput**(`input`): `string`

Defined in: [src/security/InputValidator.ts:165](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L165)

Sanitize user input by removing control characters

#### Parameters

##### input

`string`

The input string to sanitize

#### Returns

`string`

The sanitized string

***

### sanitizeUserInputSafe()

> **sanitizeUserInputSafe**(`input`): `ValidationResult`

Defined in: [src/security/InputValidator.ts:187](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L187)

Sanitize input and return a result object

#### Parameters

##### input

`string`

The input string to sanitize

#### Returns

`ValidationResult`

Validation result with sanitized value

***

### isValidEmail()

> **isValidEmail**(`email`): `boolean`

Defined in: [src/security/InputValidator.ts:205](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L205)

Validate an email address format

#### Parameters

##### email

`string`

The email to validate

#### Returns

`boolean`

True if the email format is valid

***

### validateGitHubRepo()

> **validateGitHubRepo**(`repoRef`): `string`

Defined in: [src/security/InputValidator.ts:219](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L219)

Validate a GitHub repository URL or path

#### Parameters

##### repoRef

`string`

Repository reference (URL or owner/repo format)

#### Returns

`string`

Validated repository reference

#### Throws

ValidationError if format is invalid

***

### isValidSemver()

> **isValidSemver**(`version`): `boolean`

Defined in: [src/security/InputValidator.ts:257](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L257)

Validate a semantic version string

#### Parameters

##### version

`string`

The version string to validate

#### Returns

`boolean`

True if the version is valid semver

***

### isValidBranchName()

> **isValidBranchName**(`branchName`): `boolean`

Defined in: [src/security/InputValidator.ts:269](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L269)

Validate a branch name

#### Parameters

##### branchName

`string`

The branch name to validate

#### Returns

`boolean`

True if the branch name is valid

***

### getBasePath()

> **getBasePath**(): `string`

Defined in: [src/security/InputValidator.ts:303](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/InputValidator.ts#L303)

Get the configured base path

#### Returns

`string`
