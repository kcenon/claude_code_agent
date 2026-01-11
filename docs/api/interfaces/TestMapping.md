[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TestMapping

# Interface: TestMapping

Defined in: [src/regression-tester/types.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L113)

Test-to-code mapping entry

## Properties

### sourceFile

> `readonly` **sourceFile**: `string`

Defined in: [src/regression-tester/types.ts:115](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L115)

Source file path

***

### testFiles

> `readonly` **testFiles**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:117](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L117)

Test files that cover this source

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/regression-tester/types.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L119)

Confidence of mapping (0.0 - 1.0)

***

### method

> `readonly` **method**: `"import"` \| `"dependency"` \| `"coverage"` \| `"naming"`

Defined in: [src/regression-tester/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L121)

Mapping method used
