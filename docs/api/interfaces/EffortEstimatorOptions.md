[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / EffortEstimatorOptions

# Interface: EffortEstimatorOptions

Defined in: [src/issue-generator/EffortEstimator.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L69)

Effort estimator configuration options

## Properties

### thresholds?

> `readonly` `optional` **thresholds**: `Partial`\<`EffortThresholds`\>

Defined in: [src/issue-generator/EffortEstimator.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L71)

Custom thresholds for effort sizes

***

### weights?

> `readonly` `optional` **weights**: `Partial`\<`EstimationWeights`\>

Defined in: [src/issue-generator/EffortEstimator.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L73)

Custom weights for estimation factors

***

### minComplexity?

> `readonly` `optional` **minComplexity**: `number`

Defined in: [src/issue-generator/EffortEstimator.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L75)

Minimum complexity score

***

### maxComplexity?

> `readonly` `optional` **maxComplexity**: `number`

Defined in: [src/issue-generator/EffortEstimator.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/EffortEstimator.ts#L77)

Maximum complexity score
