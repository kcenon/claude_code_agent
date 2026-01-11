[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSGenerationSession

# Interface: SDSGenerationSession

Defined in: [src/sds-writer/types.ts:651](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L651)

SDS generation session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/sds-writer/types.ts:653](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L653)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/sds-writer/types.ts:655](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L655)

Project identifier

***

### status

> `readonly` **status**: [`SDSGenerationStatus`](../type-aliases/SDSGenerationStatus.md)

Defined in: [src/sds-writer/types.ts:657](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L657)

Current generation status

***

### parsedSRS

> `readonly` **parsedSRS**: [`SDSParsedSRS`](SDSParsedSRS.md)

Defined in: [src/sds-writer/types.ts:659](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L659)

Parsed SRS input

***

### components?

> `readonly` `optional` **components**: readonly [`SDSComponent`](SDSComponent.md)[]

Defined in: [src/sds-writer/types.ts:661](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L661)

Designed components

***

### apis?

> `readonly` `optional` **apis**: readonly [`SDSAPIEndpoint`](SDSAPIEndpoint.md)[]

Defined in: [src/sds-writer/types.ts:663](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L663)

API specifications

***

### dataModels?

> `readonly` `optional` **dataModels**: readonly [`DataModel`](DataModel.md)[]

Defined in: [src/sds-writer/types.ts:665](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L665)

Data models

***

### traceabilityMatrix?

> `readonly` `optional` **traceabilityMatrix**: [`SDSTraceabilityMatrix`](SDSTraceabilityMatrix.md)

Defined in: [src/sds-writer/types.ts:667](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L667)

Traceability matrix

***

### generatedSDS?

> `readonly` `optional` **generatedSDS**: [`GeneratedSDS`](GeneratedSDS.md)

Defined in: [src/sds-writer/types.ts:669](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L669)

Generated SDS (when completed)

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/sds-writer/types.ts:671](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L671)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/sds-writer/types.ts:673](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L673)

Session last update time

***

### errorMessage?

> `readonly` `optional` **errorMessage**: `string`

Defined in: [src/sds-writer/types.ts:675](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L675)

Error message if failed
