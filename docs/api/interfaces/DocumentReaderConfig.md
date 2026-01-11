[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocumentReaderConfig

# Interface: DocumentReaderConfig

Defined in: [src/document-reader/types.ts:344](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L344)

Document Reader Agent configuration

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/document-reader/types.ts:346](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L346)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### docsBasePath?

> `readonly` `optional` **docsBasePath**: `string`

Defined in: [src/document-reader/types.ts:348](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L348)

Documents base path (defaults to docs)

***

### prdSubdir?

> `readonly` `optional` **prdSubdir**: `string`

Defined in: [src/document-reader/types.ts:350](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L350)

PRD subdirectory (defaults to prd)

***

### srsSubdir?

> `readonly` `optional` **srsSubdir**: `string`

Defined in: [src/document-reader/types.ts:352](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L352)

SRS subdirectory (defaults to srs)

***

### sdsSubdir?

> `readonly` `optional` **sdsSubdir**: `string`

Defined in: [src/document-reader/types.ts:354](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L354)

SDS subdirectory (defaults to sds)

***

### strictMode?

> `readonly` `optional` **strictMode**: `boolean`

Defined in: [src/document-reader/types.ts:356](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L356)

Whether to use strict parsing mode

***

### extractTraceability?

> `readonly` `optional` **extractTraceability**: `boolean`

Defined in: [src/document-reader/types.ts:358](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L358)

Whether to extract traceability mappings

***

### calculateStatistics?

> `readonly` `optional` **calculateStatistics**: `boolean`

Defined in: [src/document-reader/types.ts:360](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L360)

Whether to calculate coverage statistics

***

### maxFileSize?

> `readonly` `optional` **maxFileSize**: `number`

Defined in: [src/document-reader/types.ts:362](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L362)

Maximum file size to process (in bytes)
