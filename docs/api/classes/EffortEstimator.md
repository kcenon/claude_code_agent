[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / EffortEstimator

# Class: EffortEstimator

Defined in: [src/issue-generator/EffortEstimator.ts:83](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L83)

Estimates implementation effort for SDS components

## Constructors

### Constructor

> **new EffortEstimator**(`options`): `EffortEstimator`

Defined in: [src/issue-generator/EffortEstimator.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L89)

#### Parameters

##### options

[`EffortEstimatorOptions`](../interfaces/EffortEstimatorOptions.md) = `{}`

#### Returns

`EffortEstimator`

## Methods

### estimate()

> **estimate**(`component`): [`IssueEstimation`](../interfaces/IssueEstimation.md)

Defined in: [src/issue-generator/EffortEstimator.ts:118](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L118)

Estimate effort for a single component

#### Parameters

##### component

`SDSComponent`

The SDS component to estimate

#### Returns

[`IssueEstimation`](../interfaces/IssueEstimation.md)

Effort estimation with factors

***

### estimateAll()

> **estimateAll**(`components`): `Map`\<`string`, [`IssueEstimation`](../interfaces/IssueEstimation.md)\>

Defined in: [src/issue-generator/EffortEstimator.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L135)

Estimate effort for multiple components

#### Parameters

##### components

readonly `SDSComponent`[]

Array of SDS components

#### Returns

`Map`\<`string`, [`IssueEstimation`](../interfaces/IssueEstimation.md)\>

Map of component ID to estimation

***

### getSizeDescription()

> `static` **getSizeDescription**(`size`): `string`

Defined in: [src/issue-generator/EffortEstimator.ts:248](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L248)

Get effort size description

#### Parameters

##### size

[`EffortSize`](../type-aliases/EffortSize.md)

#### Returns

`string`

***

### shouldDecompose()

> **shouldDecompose**(`component`, `maxSize`): `boolean`

Defined in: [src/issue-generator/EffortEstimator.ts:262](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L262)

Check if a component should be decomposed based on size

#### Parameters

##### component

`SDSComponent`

##### maxSize

[`EffortSize`](../type-aliases/EffortSize.md) = `'L'`

#### Returns

`boolean`

***

### suggestDecomposition()

> **suggestDecomposition**(`component`): readonly `string`[] \| `null`

Defined in: [src/issue-generator/EffortEstimator.ts:280](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L280)

Suggest decomposition for large components

#### Parameters

##### component

`SDSComponent`

The component to analyze

#### Returns

readonly `string`[] \| `null`

Suggested sub-tasks if decomposition is needed
