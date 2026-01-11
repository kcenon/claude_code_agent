[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSComponent

# Interface: SDSComponent

Defined in: [src/sds-writer/types.ts:261](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L261)

SDS component definition

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/sds-writer/types.ts:263](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L263)

Component ID (e.g., CMP-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/sds-writer/types.ts:265](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L265)

Component name

***

### responsibility

> `readonly` **responsibility**: `string`

Defined in: [src/sds-writer/types.ts:267](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L267)

Responsibility (single responsibility description)

***

### sourceFeature

> `readonly` **sourceFeature**: `string`

Defined in: [src/sds-writer/types.ts:269](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L269)

Source feature ID (SF-XXX)

***

### priority

> `readonly` **priority**: [`SDSPriority`](../type-aliases/SDSPriority.md)

Defined in: [src/sds-writer/types.ts:271](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L271)

Priority level

***

### description

> `readonly` **description**: `string`

Defined in: [src/sds-writer/types.ts:273](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L273)

Detailed description

***

### interfaces

> `readonly` **interfaces**: readonly [`SDSInterface`](SDSInterface.md)[]

Defined in: [src/sds-writer/types.ts:275](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L275)

Component interfaces

***

### dependencies

> `readonly` **dependencies**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:277](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L277)

Dependencies on other components

***

### implementationNotes

> `readonly` **implementationNotes**: `string`

Defined in: [src/sds-writer/types.ts:279](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L279)

Implementation notes

***

### technology?

> `readonly` `optional` **technology**: `string`

Defined in: [src/sds-writer/types.ts:281](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L281)

Technology suggestions
