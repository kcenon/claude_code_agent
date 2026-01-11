[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / IssueTransformer

# Class: IssueTransformer

Defined in: [src/issue-generator/IssueTransformer.ts:41](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueTransformer.ts#L41)

Transforms SDS components into GitHub Issues

## Constructors

### Constructor

> **new IssueTransformer**(`options`, `estimator?`): `IssueTransformer`

Defined in: [src/issue-generator/IssueTransformer.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueTransformer.ts#L46)

#### Parameters

##### options

[`IssueGeneratorOptions`](../interfaces/IssueGeneratorOptions.md) = `{}`

##### estimator?

[`EffortEstimator`](EffortEstimator.md)

#### Returns

`IssueTransformer`

## Methods

### transformAll()

> **transformAll**(`sds`): readonly [`GeneratedIssue`](../interfaces/GeneratedIssue.md)[]

Defined in: [src/issue-generator/IssueTransformer.ts:56](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueTransformer.ts#L56)

Transform all components in an SDS to issues

#### Parameters

##### sds

[`ParsedSDS`](../interfaces/ParsedSDS.md)

Parsed SDS document

#### Returns

readonly [`GeneratedIssue`](../interfaces/GeneratedIssue.md)[]

Array of generated issues

***

### transformComponent()

> **transformComponent**(`component`, `traceabilityMatrix`, `estimation?`): [`GeneratedIssue`](../interfaces/GeneratedIssue.md)

Defined in: [src/issue-generator/IssueTransformer.ts:79](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueTransformer.ts#L79)

Transform a single component to an issue

#### Parameters

##### component

`SDSComponent`

##### traceabilityMatrix

readonly `TraceabilityEntry`[]

##### estimation?

[`IssueEstimation`](../interfaces/IssueEstimation.md)

#### Returns

[`GeneratedIssue`](../interfaces/GeneratedIssue.md)

***

### getComponentToIssueMap()

> **getComponentToIssueMap**(`issues`): `Map`\<`string`, `string`\>

Defined in: [src/issue-generator/IssueTransformer.ts:499](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueTransformer.ts#L499)

Get component ID to issue ID mapping

#### Parameters

##### issues

readonly [`GeneratedIssue`](../interfaces/GeneratedIssue.md)[]

Generated issues

#### Returns

`Map`\<`string`, `string`\>

Map of component ID to issue ID
