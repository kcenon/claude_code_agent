[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactAnalyzerConfig

# Interface: ImpactAnalyzerConfig

Defined in: [src/impact-analyzer/types.ts:399](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L399)

Impact Analyzer Agent configuration

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/impact-analyzer/types.ts:401](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L401)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### maxDependencyDepth?

> `readonly` `optional` **maxDependencyDepth**: `number`

Defined in: [src/impact-analyzer/types.ts:403](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L403)

Maximum dependency chain depth to trace

***

### minConfidenceThreshold?

> `readonly` `optional` **minConfidenceThreshold**: `number`

Defined in: [src/impact-analyzer/types.ts:405](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L405)

Minimum confidence threshold for including impacts

***

### includeFilePredictions?

> `readonly` `optional` **includeFilePredictions**: `boolean`

Defined in: [src/impact-analyzer/types.ts:407](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L407)

Whether to include file-level predictions

***

### includeRegressionAnalysis?

> `readonly` `optional` **includeRegressionAnalysis**: `boolean`

Defined in: [src/impact-analyzer/types.ts:409](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L409)

Whether to include regression analysis

***

### riskWeights?

> `readonly` `optional` **riskWeights**: `object`

Defined in: [src/impact-analyzer/types.ts:411](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L411)

Risk factor weights for calculation

#### complexity

> `readonly` **complexity**: `number`

#### coupling

> `readonly` **coupling**: `number`

#### scope

> `readonly` **scope**: `number`

#### testCoverage

> `readonly` **testCoverage**: `number`
