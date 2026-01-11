[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AuthenticationSpec

# Interface: AuthenticationSpec

Defined in: [src/sds-writer/types.ts:491](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L491)

Authentication specification

## Properties

### type

> `readonly` **type**: `"none"` \| `"session"` \| `"jwt"` \| `"oauth2"` \| `"api_key"`

Defined in: [src/sds-writer/types.ts:493](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L493)

Authentication type

***

### tokenExpiry?

> `readonly` `optional` **tokenExpiry**: `string`

Defined in: [src/sds-writer/types.ts:495](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L495)

Token expiry (if applicable)

***

### refreshMechanism?

> `readonly` `optional` **refreshMechanism**: `string`

Defined in: [src/sds-writer/types.ts:497](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L497)

Refresh mechanism

***

### notes?

> `readonly` `optional` **notes**: `string`

Defined in: [src/sds-writer/types.ts:499](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L499)

Additional notes
