[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AffectedTest

# Interface: AffectedTest

Defined in: [src/regression-tester/types.ts:141](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L141)

Affected test entry

## Properties

### testFile

> `readonly` **testFile**: `string`

Defined in: [src/regression-tester/types.ts:143](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L143)

Test file path

***

### testName

> `readonly` **testName**: `string`

Defined in: [src/regression-tester/types.ts:145](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L145)

Test name

***

### relatedChanges

> `readonly` **relatedChanges**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:147](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L147)

Related changed files

***

### priority

> `readonly` **priority**: [`TestPriority`](../type-aliases/TestPriority.md)

Defined in: [src/regression-tester/types.ts:149](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L149)

Test priority

***

### reason

> `readonly` **reason**: `string`

Defined in: [src/regression-tester/types.ts:151](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L151)

Reason for being affected
