[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocumentReadingResult

# Interface: DocumentReadingResult

Defined in: [src/document-reader/types.ts:383](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L383)

Document reading result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/document-reader/types.ts:385](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L385)

Whether reading was successful

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/document-reader/types.ts:387](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L387)

Project ID

***

### outputPath

> `readonly` **outputPath**: `string`

Defined in: [src/document-reader/types.ts:389](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L389)

Path to the current_state.yaml file

***

### currentState

> `readonly` **currentState**: [`CurrentState`](CurrentState.md)

Defined in: [src/document-reader/types.ts:391](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L391)

The current state

***

### stats

> `readonly` **stats**: [`DocumentReadingStats`](DocumentReadingStats.md)

Defined in: [src/document-reader/types.ts:393](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L393)

Reading statistics

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/document-reader/types.ts:395](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L395)

Warnings during reading
