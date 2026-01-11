[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSTemplateVariable

# Interface: SRSTemplateVariable

Defined in: [src/srs-writer/types.ts:382](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L382)

Template variable for substitution

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/srs-writer/types.ts:384](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L384)

Variable name (without ${})

***

### value

> `readonly` **value**: `string`

Defined in: [src/srs-writer/types.ts:386](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L386)

Variable value

***

### required

> `readonly` **required**: `boolean`

Defined in: [src/srs-writer/types.ts:388](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L388)

Whether this variable is required
