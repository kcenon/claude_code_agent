[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSParsedNFR

# Interface: SDSParsedNFR

Defined in: [src/sds-writer/types.ts:122](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L122)

Parsed NFR from SRS

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/sds-writer/types.ts:124](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L124)

NFR ID (e.g., NFR-001)

***

### category

> `readonly` **category**: `string`

Defined in: [src/sds-writer/types.ts:126](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L126)

Category (performance, security, etc.)

***

### description

> `readonly` **description**: `string`

Defined in: [src/sds-writer/types.ts:128](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L128)

Description

***

### metric?

> `readonly` `optional` **metric**: `string`

Defined in: [src/sds-writer/types.ts:130](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L130)

Metric/target

***

### priority

> `readonly` **priority**: [`SDSPriority`](../type-aliases/SDSPriority.md)

Defined in: [src/sds-writer/types.ts:132](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L132)

Priority
