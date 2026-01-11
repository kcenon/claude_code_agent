[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / IssueGeneratorConfig

# Interface: IssueGeneratorConfig

Defined in: [src/issue-generator/IssueGenerator.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L30)

Full configuration options for IssueGenerator

## Properties

### generator?

> `readonly` `optional` **generator**: [`IssueGeneratorOptions`](IssueGeneratorOptions.md)

Defined in: [src/issue-generator/IssueGenerator.ts:32](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L32)

Generator options

***

### parser?

> `readonly` `optional` **parser**: [`SDSParserOptions`](SDSParserOptions.md)

Defined in: [src/issue-generator/IssueGenerator.ts:34](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L34)

Parser options

***

### estimator?

> `readonly` `optional` **estimator**: [`EffortEstimatorOptions`](EffortEstimatorOptions.md)

Defined in: [src/issue-generator/IssueGenerator.ts:36](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L36)

Estimator options

***

### outputPath?

> `readonly` `optional` **outputPath**: `string`

Defined in: [src/issue-generator/IssueGenerator.ts:38](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L38)

Base path for output files

***

### validateSDS?

> `readonly` `optional` **validateSDS**: `boolean`

Defined in: [src/issue-generator/IssueGenerator.ts:40](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/IssueGenerator.ts#L40)

Validate SDS before processing
