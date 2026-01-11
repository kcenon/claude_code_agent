[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRDTemplateVariable

# Interface: PRDTemplateVariable

Defined in: [src/prd-writer/types.ts:289](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L289)

Template variable for substitution

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/prd-writer/types.ts:291](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L291)

Variable name (without ${})

***

### value

> `readonly` **value**: `string`

Defined in: [src/prd-writer/types.ts:293](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L293)

Variable value

***

### required

> `readonly` **required**: `boolean`

Defined in: [src/prd-writer/types.ts:295](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L295)

Whether this variable is required
