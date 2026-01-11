[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionAnalysisResult

# Interface: RegressionAnalysisResult

Defined in: [src/regression-tester/types.ts:392](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L392)

Regression analysis result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/regression-tester/types.ts:394](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L394)

Whether analysis was successful

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/regression-tester/types.ts:396](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L396)

Project ID

***

### outputPath

> `readonly` **outputPath**: `string`

Defined in: [src/regression-tester/types.ts:398](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L398)

Path to regression_report.yaml

***

### report

> `readonly` **report**: [`RegressionReport`](RegressionReport.md)

Defined in: [src/regression-tester/types.ts:400](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L400)

Regression report

***

### stats

> `readonly` **stats**: [`RegressionAnalysisStats`](RegressionAnalysisStats.md)

Defined in: [src/regression-tester/types.ts:402](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L402)

Analysis statistics

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:404](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L404)

Warnings during analysis
