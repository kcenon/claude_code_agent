[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TestResult

# Interface: TestResult

Defined in: [src/regression-tester/types.ts:171](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L171)

Individual test result

## Properties

### testFile

> `readonly` **testFile**: `string`

Defined in: [src/regression-tester/types.ts:173](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L173)

Test file path

***

### testName

> `readonly` **testName**: `string`

Defined in: [src/regression-tester/types.ts:175](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L175)

Test name

***

### status

> `readonly` **status**: [`TestStatus`](../type-aliases/TestStatus.md)

Defined in: [src/regression-tester/types.ts:177](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L177)

Test status

***

### durationMs

> `readonly` **durationMs**: `number`

Defined in: [src/regression-tester/types.ts:179](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L179)

Duration in milliseconds

***

### errorMessage

> `readonly` **errorMessage**: `string` \| `null`

Defined in: [src/regression-tester/types.ts:181](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L181)

Error message if failed

***

### relatedChange

> `readonly` **relatedChange**: `string` \| `null`

Defined in: [src/regression-tester/types.ts:183](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L183)

Related change that caused test to run
