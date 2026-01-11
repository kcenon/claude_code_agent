[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TestExecutionSummary

# Interface: TestExecutionSummary

Defined in: [src/regression-tester/types.ts:189](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L189)

Test execution summary

## Properties

### totalTestsRun

> `readonly` **totalTestsRun**: `number`

Defined in: [src/regression-tester/types.ts:191](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L191)

Total tests run

***

### passed

> `readonly` **passed**: `number`

Defined in: [src/regression-tester/types.ts:193](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L193)

Number of passed tests

***

### failed

> `readonly` **failed**: `number`

Defined in: [src/regression-tester/types.ts:195](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L195)

Number of failed tests

***

### skipped

> `readonly` **skipped**: `number`

Defined in: [src/regression-tester/types.ts:197](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L197)

Number of skipped tests

***

### durationSeconds

> `readonly` **durationSeconds**: `number`

Defined in: [src/regression-tester/types.ts:199](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L199)

Total duration in seconds

***

### results

> `readonly` **results**: readonly [`TestResult`](TestResult.md)[]

Defined in: [src/regression-tester/types.ts:201](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L201)

Individual test results
