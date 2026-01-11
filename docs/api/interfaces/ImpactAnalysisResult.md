[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactAnalysisResult

# Interface: ImpactAnalysisResult

Defined in: [src/impact-analyzer/types.ts:439](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L439)

Impact analysis result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/impact-analyzer/types.ts:441](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L441)

Whether analysis was successful

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/impact-analyzer/types.ts:443](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L443)

Project ID

***

### outputPath

> `readonly` **outputPath**: `string`

Defined in: [src/impact-analyzer/types.ts:445](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L445)

Path to impact_report.yaml

***

### impactAnalysis

> `readonly` **impactAnalysis**: [`ImpactAnalysis`](ImpactAnalysis.md)

Defined in: [src/impact-analyzer/types.ts:447](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L447)

Impact analysis report

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/impact-analyzer/types.ts:449](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L449)

Warnings during analysis
