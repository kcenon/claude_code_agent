[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GapItem

# Interface: GapItem

Defined in: [src/prd-writer/types.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L63)

Gap analysis result item

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/prd-writer/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L65)

Unique identifier for the gap

***

### category

> `readonly` **category**: [`GapCategory`](../type-aliases/GapCategory.md)

Defined in: [src/prd-writer/types.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L67)

Category of the gap

***

### severity

> `readonly` **severity**: [`GapSeverity`](../type-aliases/GapSeverity.md)

Defined in: [src/prd-writer/types.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L69)

Severity level

***

### section

> `readonly` **section**: [`PRDSection`](../type-aliases/PRDSection.md)

Defined in: [src/prd-writer/types.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L71)

PRD section affected

***

### description

> `readonly` **description**: `string`

Defined in: [src/prd-writer/types.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L73)

Description of the gap

***

### suggestion

> `readonly` **suggestion**: `string`

Defined in: [src/prd-writer/types.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L75)

Suggested action to resolve

***

### relatedId?

> `readonly` `optional` **relatedId**: `string`

Defined in: [src/prd-writer/types.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L77)

Related requirement ID if applicable
