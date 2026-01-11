[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionRisk

# Interface: RegressionRisk

Defined in: [src/impact-analyzer/types.ts:175](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L175)

Regression risk prediction

## Properties

### area

> `readonly` **area**: `string`

Defined in: [src/impact-analyzer/types.ts:177](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L177)

Area at risk for regression

***

### probability

> `readonly` **probability**: `number`

Defined in: [src/impact-analyzer/types.ts:179](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L179)

Probability of regression (0.0 - 1.0)

***

### severity

> `readonly` **severity**: [`RiskLevel`](../type-aliases/RiskLevel.md)

Defined in: [src/impact-analyzer/types.ts:181](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L181)

Severity if regression occurs

***

### testsToRun

> `readonly` **testsToRun**: readonly `string`[]

Defined in: [src/impact-analyzer/types.ts:183](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L183)

Tests recommended to run

***

### reason

> `readonly` **reason**: `string`

Defined in: [src/impact-analyzer/types.ts:185](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L185)

Reason for the risk assessment
