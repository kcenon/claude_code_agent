[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SecretManager

# Class: SecretManager

Defined in: [src/security/SecretManager.ts:23](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L23)

Manages secure access to secrets and API keys

## Constructors

### Constructor

> **new SecretManager**(`options`): `SecretManager`

Defined in: [src/security/SecretManager.ts:29](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L29)

#### Parameters

##### options

[`SecretManagerOptions`](../interfaces/SecretManagerOptions.md) = `{}`

#### Returns

`SecretManager`

## Methods

### load()

> **load**(): `void`

Defined in: [src/security/SecretManager.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L44)

Initialize the secret manager by loading secrets from environment

#### Returns

`void`

***

### get()

> **get**(`key`): `string`

Defined in: [src/security/SecretManager.ts:103](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L103)

Get a secret value by key

#### Parameters

##### key

`string`

The secret key to retrieve

#### Returns

`string`

The secret value

#### Throws

SecretNotFoundError if the secret is not found

***

### getOrDefault()

> **getOrDefault**(`key`, `defaultValue`): `string`

Defined in: [src/security/SecretManager.ts:118](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L118)

Get a secret value or return a default

#### Parameters

##### key

`string`

The secret key to retrieve

##### defaultValue

`string`

The default value if not found

#### Returns

`string`

The secret value or default

***

### has()

> **has**(`key`): `boolean`

Defined in: [src/security/SecretManager.ts:128](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L128)

Check if a secret exists

#### Parameters

##### key

`string`

The secret key to check

#### Returns

`boolean`

True if the secret exists

***

### mask()

> **mask**(`text`): `string`

Defined in: [src/security/SecretManager.ts:139](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L139)

Mask all known secrets in a text string
Use this to sanitize logs and error messages

#### Parameters

##### text

`string`

The text to mask

#### Returns

`string`

The text with secrets replaced by [REDACTED]

***

### createSafeLogger()

> **createSafeLogger**(`logger`): (`message`) => `void`

Defined in: [src/security/SecretManager.ts:161](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L161)

Create a safe logger wrapper that automatically masks secrets

#### Parameters

##### logger

(`message`) => `void`

The logger function to wrap

#### Returns

A wrapped logger that masks secrets

> (`message`): `void`

##### Parameters

###### message

`string`

##### Returns

`void`

***

### getAvailableKeys()

> **getAvailableKeys**(): `string`[]

Defined in: [src/security/SecretManager.ts:172](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L172)

Get list of available secret keys (not values)

#### Returns

`string`[]

Array of secret key names

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [src/security/SecretManager.ts:179](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L179)

Check if the secret manager has been initialized

#### Returns

`boolean`

***

### set()

> **set**(`key`, `value`): `void`

Defined in: [src/security/SecretManager.ts:190](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L190)

Manually set a secret (useful for testing)
Warning: Use with caution in production

#### Parameters

##### key

`string`

The secret key

##### value

`string`

The secret value

#### Returns

`void`

***

### clear()

> **clear**(): `void`

Defined in: [src/security/SecretManager.ts:197](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/security/SecretManager.ts#L197)

Clear all secrets (useful for testing cleanup)

#### Returns

`void`
