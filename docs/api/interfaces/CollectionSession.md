[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CollectionSession

# Interface: CollectionSession

Defined in: [src/collector/types.ts:204](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L204)

Collection session state

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/collector/types.ts:206](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L206)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/collector/types.ts:208](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L208)

Project identifier

***

### status

> `readonly` **status**: `"completed"` \| `"collecting"` \| `"clarifying"`

Defined in: [src/collector/types.ts:210](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L210)

Current collection status

***

### sources

> `readonly` **sources**: readonly [`InputSource`](InputSource.md)[]

Defined in: [src/collector/types.ts:212](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L212)

All input sources processed

***

### extraction

> `readonly` **extraction**: [`ExtractionResult`](ExtractionResult.md)

Defined in: [src/collector/types.ts:214](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L214)

Current extraction result

***

### pendingQuestions

> `readonly` **pendingQuestions**: readonly [`ClarificationQuestion`](ClarificationQuestion.md)[]

Defined in: [src/collector/types.ts:216](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L216)

Pending clarification questions

***

### answeredQuestions

> `readonly` **answeredQuestions**: readonly [`ClarificationAnswer`](ClarificationAnswer.md)[]

Defined in: [src/collector/types.ts:218](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L218)

Answered clarification questions

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/collector/types.ts:220](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L220)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/collector/types.ts:222](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L222)

Session last update time
