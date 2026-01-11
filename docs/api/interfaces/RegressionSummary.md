[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionSummary

# Interface: RegressionSummary

Defined in: [src/regression-tester/types.ts:275](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L275)

Regression report summary

## Properties

### status

> `readonly` **status**: [`RegressionStatus`](../type-aliases/RegressionStatus.md)

Defined in: [src/regression-tester/types.ts:277](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L277)

Overall status

***

### totalIssues

> `readonly` **totalIssues**: `number`

Defined in: [src/regression-tester/types.ts:279](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L279)

Total issues found

***

### blockingIssues

> `readonly` **blockingIssues**: `number`

Defined in: [src/regression-tester/types.ts:281](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L281)

Number of blocking issues

***

### message

> `readonly` **message**: `string`

Defined in: [src/regression-tester/types.ts:283](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L283)

Summary message
