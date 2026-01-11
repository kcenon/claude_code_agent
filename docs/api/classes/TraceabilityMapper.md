[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TraceabilityMapper

# Class: TraceabilityMapper

Defined in: [src/sds-writer/TraceabilityMapper.ts:79](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L79)

Mapper for building traceability matrices

## Constructors

### Constructor

> **new TraceabilityMapper**(`options`): `TraceabilityMapper`

Defined in: [src/sds-writer/TraceabilityMapper.ts:82](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L82)

#### Parameters

##### options

[`TraceabilityMapperOptions`](../interfaces/TraceabilityMapperOptions.md) = `{}`

#### Returns

`TraceabilityMapper`

## Methods

### build()

> **build**(`srs`, `components`): [`TraceabilityAnalysis`](../interfaces/TraceabilityAnalysis.md)

Defined in: [src/sds-writer/TraceabilityMapper.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L93)

Build a traceability matrix from SRS and SDS components

#### Parameters

##### srs

[`SDSParsedSRS`](../interfaces/SDSParsedSRS.md)

Parsed SRS document

##### components

readonly [`SDSComponent`](../interfaces/SDSComponent.md)[]

Designed SDS components

#### Returns

[`TraceabilityAnalysis`](../interfaces/TraceabilityAnalysis.md)

Traceability analysis

#### Throws

LowCoverageError if coverage is below threshold and failOnLowCoverage is true

***

### toMarkdownTable()

> **toMarkdownTable**(`matrix`): `string`

Defined in: [src/sds-writer/TraceabilityMapper.ts:217](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L217)

Generate a markdown table from the traceability matrix

#### Parameters

##### matrix

[`SDSTraceabilityMatrix`](../interfaces/SDSTraceabilityMatrix.md)

Traceability matrix

#### Returns

`string`

Markdown table string

***

### validate()

> **validate**(`matrix`): readonly `string`[]

Defined in: [src/sds-writer/TraceabilityMapper.ts:259](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L259)

Validate traceability completeness

#### Parameters

##### matrix

[`SDSTraceabilityMatrix`](../interfaces/SDSTraceabilityMatrix.md)

Traceability matrix

#### Returns

readonly `string`[]

Validation errors

***

### getSummary()

> **getSummary**(`analysis`): `string`

Defined in: [src/sds-writer/TraceabilityMapper.ts:289](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L289)

Get a summary report of the traceability

#### Parameters

##### analysis

[`TraceabilityAnalysis`](../interfaces/TraceabilityAnalysis.md)

Traceability analysis

#### Returns

`string`

Summary report

***

### merge()

> **merge**(...`matrices`): [`SDSTraceabilityMatrix`](../interfaces/SDSTraceabilityMatrix.md)

Defined in: [src/sds-writer/TraceabilityMapper.ts:352](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L352)

Merge multiple traceability matrices

#### Parameters

##### matrices

...[`SDSTraceabilityMatrix`](../interfaces/SDSTraceabilityMatrix.md)[]

Matrices to merge

#### Returns

[`SDSTraceabilityMatrix`](../interfaces/SDSTraceabilityMatrix.md)

Merged matrix

***

### filterByPriority()

> **filterByPriority**(`matrix`, `components`, `minPriority`): [`SDSTraceabilityMatrix`](../interfaces/SDSTraceabilityMatrix.md)

Defined in: [src/sds-writer/TraceabilityMapper.ts:398](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/TraceabilityMapper.ts#L398)

Filter matrix by priority

#### Parameters

##### matrix

[`SDSTraceabilityMatrix`](../interfaces/SDSTraceabilityMatrix.md)

Traceability matrix

##### components

readonly [`SDSComponent`](../interfaces/SDSComponent.md)[]

Components with priority info

##### minPriority

Minimum priority to include (P0 is highest)

`"P0"` | `"P1"` | `"P2"` | `"P3"`

#### Returns

[`SDSTraceabilityMatrix`](../interfaces/SDSTraceabilityMatrix.md)

Filtered matrix
