[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AuditLogger

# Class: AuditLogger

Defined in: [src/security/AuditLogger.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L44)

Audit logger for security-sensitive operations

## Constructors

### Constructor

> **new AuditLogger**(`options`): `AuditLogger`

Defined in: [src/security/AuditLogger.ts:54](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L54)

#### Parameters

##### options

[`AuditLoggerOptions`](../interfaces/AuditLoggerOptions.md) = `{}`

#### Returns

`AuditLogger`

## Methods

### log()

> **log**(`event`): `void`

Defined in: [src/security/AuditLogger.ts:126](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L126)

Log an audit event

#### Parameters

##### event

[`AuditEvent`](../interfaces/AuditEvent.md)

The audit event to log

#### Returns

`void`

***

### logApiKeyUsage()

> **logApiKeyUsage**(`keyName`, `actor`, `success`): `void`

Defined in: [src/security/AuditLogger.ts:180](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L180)

Log API key usage

#### Parameters

##### keyName

`string`

##### actor

`string`

##### success

`boolean`

#### Returns

`void`

***

### logGitHubIssueCreated()

> **logGitHubIssueCreated**(`issueNumber`, `repo`, `actor`): `void`

Defined in: [src/security/AuditLogger.ts:193](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L193)

Log GitHub issue creation

#### Parameters

##### issueNumber

`number`

##### repo

`string`

##### actor

`string`

#### Returns

`void`

***

### logGitHubPRCreated()

> **logGitHubPRCreated**(`prNumber`, `repo`, `actor`): `void`

Defined in: [src/security/AuditLogger.ts:206](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L206)

Log GitHub PR creation

#### Parameters

##### prNumber

`number`

##### repo

`string`

##### actor

`string`

#### Returns

`void`

***

### logGitHubPRMerged()

> **logGitHubPRMerged**(`prNumber`, `repo`, `actor`): `void`

Defined in: [src/security/AuditLogger.ts:219](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L219)

Log GitHub PR merge

#### Parameters

##### prNumber

`number`

##### repo

`string`

##### actor

`string`

#### Returns

`void`

***

### logFileCreated()

> **logFileCreated**(`filePath`, `actor`): `void`

Defined in: [src/security/AuditLogger.ts:232](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L232)

Log file creation

#### Parameters

##### filePath

`string`

##### actor

`string`

#### Returns

`void`

***

### logFileDeleted()

> **logFileDeleted**(`filePath`, `actor`): `void`

Defined in: [src/security/AuditLogger.ts:245](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L245)

Log file deletion

#### Parameters

##### filePath

`string`

##### actor

`string`

#### Returns

`void`

***

### logFileModified()

> **logFileModified**(`filePath`, `actor`): `void`

Defined in: [src/security/AuditLogger.ts:258](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L258)

Log file modification

#### Parameters

##### filePath

`string`

##### actor

`string`

#### Returns

`void`

***

### logSecretAccessed()

> **logSecretAccessed**(`secretName`, `actor`): `void`

Defined in: [src/security/AuditLogger.ts:271](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L271)

Log secret access

#### Parameters

##### secretName

`string`

##### actor

`string`

#### Returns

`void`

***

### logValidationFailed()

> **logValidationFailed**(`field`, `actor`, `details?`): `void`

Defined in: [src/security/AuditLogger.ts:284](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L284)

Log validation failure

#### Parameters

##### field

`string`

##### actor

`string`

##### details?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### logSecurityViolation()

> **logSecurityViolation**(`violationType`, `actor`, `details?`): `void`

Defined in: [src/security/AuditLogger.ts:306](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L306)

Log security violation

#### Parameters

##### violationType

`string`

##### actor

`string`

##### details?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### setCorrelationId()

> **setCorrelationId**(`correlationId`): `void`

Defined in: [src/security/AuditLogger.ts:330](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L330)

Set a new correlation ID for request tracing

#### Parameters

##### correlationId

`string`

The correlation ID to set

#### Returns

`void`

***

### getCorrelationId()

> **getCorrelationId**(): `string`

Defined in: [src/security/AuditLogger.ts:337](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L337)

Get the current correlation ID

#### Returns

`string`

***

### newCorrelationId()

> **newCorrelationId**(): `string`

Defined in: [src/security/AuditLogger.ts:344](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L344)

Generate a new correlation ID

#### Returns

`string`

***

### getSessionId()

> **getSessionId**(): `string`

Defined in: [src/security/AuditLogger.ts:352](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L352)

Get the current session ID

#### Returns

`string`

***

### setSessionId()

> **setSessionId**(`sessionId`): `void`

Defined in: [src/security/AuditLogger.ts:359](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L359)

Set the session ID

#### Parameters

##### sessionId

`string`

#### Returns

`void`

***

### getLogDir()

> **getLogDir**(): `string`

Defined in: [src/security/AuditLogger.ts:366](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L366)

Get the log directory path

#### Returns

`string`

***

### getCurrentLogFile()

> **getCurrentLogFile**(): `string` \| `null`

Defined in: [src/security/AuditLogger.ts:373](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L373)

Get the current log file path

#### Returns

`string` \| `null`

***

### getRecentEntries()

> **getRecentEntries**(`limit`): [`AuditLogEntry`](../interfaces/AuditLogEntry.md)[]

Defined in: [src/security/AuditLogger.ts:383](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/AuditLogger.ts#L383)

Read recent audit entries

#### Parameters

##### limit

`number` = `100`

Maximum number of entries to return

#### Returns

[`AuditLogEntry`](../interfaces/AuditLogEntry.md)[]

Array of recent audit log entries
