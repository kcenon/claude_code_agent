[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FileParseResult

# Interface: FileParseResult

Defined in: [src/collector/types.ts:288](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L288)

File parsing result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/collector/types.ts:290](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L290)

Whether parsing was successful

***

### content

> `readonly` **content**: `string`

Defined in: [src/collector/types.ts:292](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L292)

Parsed content

***

### fileType

> `readonly` **fileType**: [`SupportedFileType`](../type-aliases/SupportedFileType.md)

Defined in: [src/collector/types.ts:294](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L294)

File type that was parsed

***

### error?

> `readonly` `optional` **error**: `string`

Defined in: [src/collector/types.ts:296](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L296)

Any errors during parsing

***

### metadata?

> `readonly` `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [src/collector/types.ts:298](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L298)

Metadata extracted from the file
