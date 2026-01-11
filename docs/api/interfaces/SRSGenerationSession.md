[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSGenerationSession

# Interface: SRSGenerationSession

Defined in: [src/srs-writer/types.ts:298](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L298)

SRS generation session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/srs-writer/types.ts:300](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L300)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/srs-writer/types.ts:302](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L302)

Project identifier

***

### status

> `readonly` **status**: [`SRSGenerationStatus`](../type-aliases/SRSGenerationStatus.md)

Defined in: [src/srs-writer/types.ts:304](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L304)

Current generation status

***

### parsedPRD

> `readonly` **parsedPRD**: [`ParsedPRD`](ParsedPRD.md)

Defined in: [src/srs-writer/types.ts:306](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L306)

Parsed PRD input

***

### decompositionResult?

> `readonly` `optional` **decompositionResult**: [`FeatureDecompositionResult`](FeatureDecompositionResult.md)

Defined in: [src/srs-writer/types.ts:308](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L308)

Feature decomposition result

***

### traceabilityMatrix?

> `readonly` `optional` **traceabilityMatrix**: [`SRSWriterTraceabilityMatrix`](SRSWriterTraceabilityMatrix.md)

Defined in: [src/srs-writer/types.ts:310](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L310)

Traceability matrix

***

### generatedSRS?

> `readonly` `optional` **generatedSRS**: [`SRSWriterGeneratedSRS`](SRSWriterGeneratedSRS.md)

Defined in: [src/srs-writer/types.ts:312](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L312)

Generated SRS (when completed)

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/srs-writer/types.ts:314](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L314)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/srs-writer/types.ts:316](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L316)

Session last update time

***

### errorMessage?

> `readonly` `optional` **errorMessage**: `string`

Defined in: [src/srs-writer/types.ts:318](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L318)

Error message if failed
