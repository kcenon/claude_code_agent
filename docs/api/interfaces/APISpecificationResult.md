[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / APISpecificationResult

# Interface: APISpecificationResult

Defined in: [src/sds-writer/APISpecifier.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/APISpecifier.ts#L49)

API specification result

## Properties

### endpoints

> `readonly` **endpoints**: readonly [`SDSAPIEndpoint`](SDSAPIEndpoint.md)[]

Defined in: [src/sds-writer/APISpecifier.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/APISpecifier.ts#L51)

Generated API endpoints

***

### failedUseCases

> `readonly` **failedUseCases**: readonly `string`[]

Defined in: [src/sds-writer/APISpecifier.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/APISpecifier.ts#L53)

Use cases that could not be converted

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/sds-writer/APISpecifier.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/APISpecifier.ts#L55)

Specification warnings
