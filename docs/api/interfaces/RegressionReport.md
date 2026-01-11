[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionReport

# Interface: RegressionReport

Defined in: [src/regression-tester/types.ts:289](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L289)

Complete regression report

## Properties

### analysisDate

> `readonly` **analysisDate**: `string`

Defined in: [src/regression-tester/types.ts:291](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L291)

Analysis timestamp

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/regression-tester/types.ts:293](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L293)

Project identifier

***

### changesAnalyzed

> `readonly` **changesAnalyzed**: [`ChangesAnalyzed`](ChangesAnalyzed.md)

Defined in: [src/regression-tester/types.ts:295](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L295)

Changes analyzed summary

***

### testMapping

> `readonly` **testMapping**: [`TestMappingSummary`](TestMappingSummary.md)

Defined in: [src/regression-tester/types.ts:297](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L297)

Test mapping summary

***

### affectedTests

> `readonly` **affectedTests**: readonly [`AffectedTest`](AffectedTest.md)[]

Defined in: [src/regression-tester/types.ts:299](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L299)

List of affected tests

***

### testExecution

> `readonly` **testExecution**: [`TestExecutionSummary`](TestExecutionSummary.md)

Defined in: [src/regression-tester/types.ts:301](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L301)

Test execution summary

***

### coverageImpact

> `readonly` **coverageImpact**: [`CoverageImpact`](CoverageImpact.md) \| `null`

Defined in: [src/regression-tester/types.ts:303](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L303)

Coverage impact analysis

***

### compatibilityIssues

> `readonly` **compatibilityIssues**: readonly [`CompatibilityIssue`](CompatibilityIssue.md)[]

Defined in: [src/regression-tester/types.ts:305](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L305)

Compatibility issues found

***

### recommendations

> `readonly` **recommendations**: readonly [`RegressionRecommendation`](RegressionRecommendation.md)[]

Defined in: [src/regression-tester/types.ts:307](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L307)

Recommendations

***

### summary

> `readonly` **summary**: [`RegressionSummary`](RegressionSummary.md)

Defined in: [src/regression-tester/types.ts:309](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/types.ts#L309)

Overall summary
