[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TraceabilityBuilder

# Class: TraceabilityBuilder

Defined in: [src/srs-writer/TraceabilityBuilder.ts:40](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L40)

Traceability Builder class

## Constructors

### Constructor

> **new TraceabilityBuilder**(`options`): `TraceabilityBuilder`

Defined in: [src/srs-writer/TraceabilityBuilder.ts:43](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L43)

#### Parameters

##### options

[`TraceabilityBuilderOptions`](../interfaces/TraceabilityBuilderOptions.md) = `{}`

#### Returns

`TraceabilityBuilder`

## Methods

### build()

> **build**(`parsedPRD`, `decompositionResult`): [`SRSWriterTraceabilityMatrix`](../interfaces/SRSWriterTraceabilityMatrix.md)

Defined in: [src/srs-writer/TraceabilityBuilder.ts:54](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L54)

Build traceability matrix from PRD and decomposition result

#### Parameters

##### parsedPRD

[`ParsedPRD`](../interfaces/ParsedPRD.md)

The parsed PRD document

##### decompositionResult

[`FeatureDecompositionResult`](../interfaces/FeatureDecompositionResult.md)

The feature decomposition result

#### Returns

[`SRSWriterTraceabilityMatrix`](../interfaces/SRSWriterTraceabilityMatrix.md)

Complete traceability matrix

***

### validate()

> **validate**(`matrix`): [`TraceabilityValidationResult`](../interfaces/TraceabilityValidationResult.md)

Defined in: [src/srs-writer/TraceabilityBuilder.ts:206](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L206)

Validate the traceability matrix

#### Parameters

##### matrix

[`SRSWriterTraceabilityMatrix`](../interfaces/SRSWriterTraceabilityMatrix.md)

The traceability matrix to validate

#### Returns

[`TraceabilityValidationResult`](../interfaces/TraceabilityValidationResult.md)

Validation result with any issues found

***

### toMarkdown()

> **toMarkdown**(`matrix`): `string`

Defined in: [src/srs-writer/TraceabilityBuilder.ts:264](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L264)

Generate traceability matrix as markdown

#### Parameters

##### matrix

[`SRSWriterTraceabilityMatrix`](../interfaces/SRSWriterTraceabilityMatrix.md)

The traceability matrix

#### Returns

`string`

Markdown representation

***

### buildReverseTraceability()

> **buildReverseTraceability**(`matrix`): `Map`\<`string`, `string`[]\>

Defined in: [src/srs-writer/TraceabilityBuilder.ts:298](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/TraceabilityBuilder.ts#L298)

Generate reverse traceability (feature to requirements)

#### Parameters

##### matrix

[`SRSWriterTraceabilityMatrix`](../interfaces/SRSWriterTraceabilityMatrix.md)

#### Returns

`Map`\<`string`, `string`[]\>
