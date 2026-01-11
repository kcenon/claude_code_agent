[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TestFile

# Interface: TestFile

Defined in: [src/regression-tester/types.ts:85](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L85)

Test file information

## Properties

### path

> `readonly` **path**: `string`

Defined in: [src/regression-tester/types.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L87)

Test file path

***

### framework

> `readonly` **framework**: [`TestFramework`](../type-aliases/TestFramework.md)

Defined in: [src/regression-tester/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L89)

Test framework detected

***

### testCount

> `readonly` **testCount**: `number`

Defined in: [src/regression-tester/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L91)

Number of test cases in file

***

### coversFiles

> `readonly` **coversFiles**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L93)

Source files this test covers
