[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionTesterSession

# Interface: RegressionTesterSession

Defined in: [src/regression-tester/types.ts:315](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L315)

Regression tester session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/regression-tester/types.ts:317](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L317)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/regression-tester/types.ts:319](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L319)

Project identifier

***

### status

> `readonly` **status**: [`RegressionSessionStatus`](../type-aliases/RegressionSessionStatus.md)

Defined in: [src/regression-tester/types.ts:321](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L321)

Session status

***

### projectPath

> `readonly` **projectPath**: `string`

Defined in: [src/regression-tester/types.ts:323](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L323)

Project root path

***

### changedFiles

> `readonly` **changedFiles**: readonly [`ChangedFile`](ChangedFile.md)[]

Defined in: [src/regression-tester/types.ts:325](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L325)

Changed files being analyzed

***

### testMappings

> `readonly` **testMappings**: readonly [`TestMapping`](TestMapping.md)[]

Defined in: [src/regression-tester/types.ts:327](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L327)

Test mapping result

***

### affectedTests

> `readonly` **affectedTests**: readonly [`AffectedTest`](AffectedTest.md)[]

Defined in: [src/regression-tester/types.ts:329](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L329)

Affected tests identified

***

### report

> `readonly` **report**: [`RegressionReport`](RegressionReport.md) \| `null`

Defined in: [src/regression-tester/types.ts:331](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L331)

Regression report result

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/regression-tester/types.ts:333](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L333)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/regression-tester/types.ts:335](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L335)

Session last update time

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:337](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L337)

Warnings during analysis

***

### errors

> `readonly` **errors**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:339](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L339)

Errors during analysis
