[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ModeDetectionSession

# Interface: ModeDetectionSession

Defined in: [src/mode-detector/types.ts:131](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L131)

Mode detection session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/mode-detector/types.ts:133](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L133)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/mode-detector/types.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L135)

Project identifier

***

### status

> `readonly` **status**: [`ModeDetectionStatus`](../type-aliases/ModeDetectionStatus.md)

Defined in: [src/mode-detector/types.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L137)

Session status

***

### rootPath

> `readonly` **rootPath**: `string`

Defined in: [src/mode-detector/types.ts:139](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L139)

Project root path

***

### userInput

> `readonly` **userInput**: `string`

Defined in: [src/mode-detector/types.ts:141](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L141)

User input for keyword analysis

***

### result

> `readonly` **result**: [`ModeDetectionResult`](ModeDetectionResult.md) \| `null`

Defined in: [src/mode-detector/types.ts:143](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L143)

Detection result (if completed)

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/mode-detector/types.ts:145](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L145)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/mode-detector/types.ts:147](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L147)

Session last update time

***

### errors

> `readonly` **errors**: readonly `string`[]

Defined in: [src/mode-detector/types.ts:149](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/mode-detector/types.ts#L149)

Any errors during detection
