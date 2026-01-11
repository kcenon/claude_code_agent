[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionTesterConfig

# Interface: RegressionTesterConfig

Defined in: [src/regression-tester/types.ts:345](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L345)

Regression tester configuration

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/regression-tester/types.ts:347](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L347)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### testPatterns?

> `readonly` `optional` **testPatterns**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:349](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L349)

Test directory patterns

***

### excludePatterns?

> `readonly` `optional` **excludePatterns**: readonly `string`[]

Defined in: [src/regression-tester/types.ts:351](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L351)

Files to exclude from analysis

***

### runTests?

> `readonly` `optional` **runTests**: `boolean`

Defined in: [src/regression-tester/types.ts:353](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L353)

Whether to run tests

***

### collectCoverage?

> `readonly` `optional` **collectCoverage**: `boolean`

Defined in: [src/regression-tester/types.ts:355](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L355)

Whether to collect coverage

***

### testTimeout?

> `readonly` `optional` **testTimeout**: `number`

Defined in: [src/regression-tester/types.ts:357](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L357)

Test timeout in milliseconds

***

### maxTests?

> `readonly` `optional` **maxTests**: `number`

Defined in: [src/regression-tester/types.ts:359](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L359)

Maximum tests to run (0 = unlimited)

***

### coverageThreshold?

> `readonly` `optional` **coverageThreshold**: `number`

Defined in: [src/regression-tester/types.ts:361](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L361)

Coverage threshold for warnings

***

### detectBreakingChanges?

> `readonly` `optional` **detectBreakingChanges**: `boolean`

Defined in: [src/regression-tester/types.ts:363](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L363)

Whether to detect breaking changes
