[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SecuritySpec

# Interface: SecuritySpec

Defined in: [src/sds-writer/types.ts:479](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L479)

Security specification

## Properties

### authentication

> `readonly` **authentication**: [`AuthenticationSpec`](AuthenticationSpec.md)

Defined in: [src/sds-writer/types.ts:481](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L481)

Authentication mechanism

***

### authorization

> `readonly` **authorization**: [`AuthorizationSpec`](AuthorizationSpec.md)

Defined in: [src/sds-writer/types.ts:483](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L483)

Authorization rules

***

### dataProtection

> `readonly` **dataProtection**: readonly [`DataProtectionMeasure`](DataProtectionMeasure.md)[]

Defined in: [src/sds-writer/types.ts:485](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L485)

Data protection measures
