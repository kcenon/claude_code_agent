[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TestMappingSummary

# Interface: TestMappingSummary

Defined in: [src/regression-tester/types.ts:127](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L127)

Test mapping summary

## Properties

### totalTestFiles

> `readonly` **totalTestFiles**: `number`

Defined in: [src/regression-tester/types.ts:129](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L129)

Total test files found

***

### totalTestCases

> `readonly` **totalTestCases**: `number`

Defined in: [src/regression-tester/types.ts:131](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L131)

Total test cases found

***

### mappingCoverage

> `readonly` **mappingCoverage**: `number`

Defined in: [src/regression-tester/types.ts:133](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L133)

Mapping coverage ratio (0.0 - 1.0)

***

### unmappedSourceFiles

> `readonly` **unmappedSourceFiles**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L135)

Source files without test mapping
