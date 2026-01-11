[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TestCase

# Interface: TestCase

Defined in: [src/regression-tester/types.ts:99](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L99)

Test case information

## Properties

### file

> `readonly` **file**: `string`

Defined in: [src/regression-tester/types.ts:101](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L101)

Test file path

***

### name

> `readonly` **name**: `string`

Defined in: [src/regression-tester/types.ts:103](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L103)

Test name

***

### suite?

> `readonly` `optional` **suite**: `string`

Defined in: [src/regression-tester/types.ts:105](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L105)

Test suite/describe block name

***

### line?

> `readonly` `optional` **line**: `number`

Defined in: [src/regression-tester/types.ts:107](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L107)

Line number in test file
