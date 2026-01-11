[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionRecommendation

# Interface: RegressionRecommendation

Defined in: [src/regression-tester/types.ts:261](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L261)

Recommendation entry

## Properties

### type

> `readonly` **type**: [`RegressionRecommendationType`](../type-aliases/RegressionRecommendationType.md)

Defined in: [src/regression-tester/types.ts:263](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L263)

Recommendation type

***

### priority

> `readonly` **priority**: [`TestPriority`](../type-aliases/TestPriority.md)

Defined in: [src/regression-tester/types.ts:265](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L265)

Priority level

***

### message

> `readonly` **message**: `string`

Defined in: [src/regression-tester/types.ts:267](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L267)

Recommendation message

***

### relatedTests

> `readonly` **relatedTests**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:269](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L269)

Related tests
