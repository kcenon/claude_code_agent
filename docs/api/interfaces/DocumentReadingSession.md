[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocumentReadingSession

# Interface: DocumentReadingSession

Defined in: [src/document-reader/types.ts:320](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L320)

Document reading session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/document-reader/types.ts:322](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L322)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/document-reader/types.ts:324](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L324)

Project identifier

***

### status

> `readonly` **status**: [`SessionStatus`](../type-aliases/SessionStatus.md)

Defined in: [src/document-reader/types.ts:326](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L326)

Session status

***

### documents

> `readonly` **documents**: readonly [`ParsedDocument`](ParsedDocument.md)[]

Defined in: [src/document-reader/types.ts:328](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L328)

Parsed documents

***

### currentState

> `readonly` **currentState**: [`CurrentState`](CurrentState.md) \| `null`

Defined in: [src/document-reader/types.ts:330](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L330)

Current state result

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/document-reader/types.ts:332](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L332)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/document-reader/types.ts:334](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L334)

Session last update time

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/document-reader/types.ts:336](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L336)

Any warnings during processing

***

### errors

> `readonly` **errors**: readonly `string`[]

Defined in: [src/document-reader/types.ts:338](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L338)

Any errors during processing
