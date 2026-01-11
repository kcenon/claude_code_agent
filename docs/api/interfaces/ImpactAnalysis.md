[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactAnalysis

# Interface: ImpactAnalysis

Defined in: [src/impact-analyzer/types.ts:223](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L223)

Complete impact analysis report

## Properties

### requestSummary

> `readonly` **requestSummary**: `string`

Defined in: [src/impact-analyzer/types.ts:225](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L225)

Summary of the change request

***

### analysisDate

> `readonly` **analysisDate**: `string`

Defined in: [src/impact-analyzer/types.ts:227](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L227)

Analysis timestamp

***

### analysisVersion

> `readonly` **analysisVersion**: `string`

Defined in: [src/impact-analyzer/types.ts:229](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L229)

Analysis version

***

### changeScope

> `readonly` **changeScope**: [`ChangeScope`](ChangeScope.md)

Defined in: [src/impact-analyzer/types.ts:231](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L231)

Change scope classification

***

### affectedComponents

> `readonly` **affectedComponents**: readonly [`AffectedComponent`](AffectedComponent.md)[]

Defined in: [src/impact-analyzer/types.ts:233](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L233)

List of affected components

***

### affectedFiles

> `readonly` **affectedFiles**: readonly [`AffectedFile`](AffectedFile.md)[]

Defined in: [src/impact-analyzer/types.ts:235](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L235)

List of affected files

***

### affectedRequirements

> `readonly` **affectedRequirements**: readonly [`AffectedRequirement`](AffectedRequirement.md)[]

Defined in: [src/impact-analyzer/types.ts:237](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L237)

List of affected requirements

***

### dependencyChain

> `readonly` **dependencyChain**: readonly [`DependencyChainEntry`](DependencyChainEntry.md)[]

Defined in: [src/impact-analyzer/types.ts:239](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L239)

Dependency chain showing impact propagation

***

### riskAssessment

> `readonly` **riskAssessment**: [`RiskAssessment`](RiskAssessment.md)

Defined in: [src/impact-analyzer/types.ts:241](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L241)

Risk assessment

***

### regressionRisks

> `readonly` **regressionRisks**: readonly [`RegressionRisk`](RegressionRisk.md)[]

Defined in: [src/impact-analyzer/types.ts:243](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L243)

Predicted regression risks

***

### recommendations

> `readonly` **recommendations**: readonly [`Recommendation`](Recommendation.md)[]

Defined in: [src/impact-analyzer/types.ts:245](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L245)

Recommendations for implementation

***

### statistics

> `readonly` **statistics**: [`ImpactAnalysisStatistics`](ImpactAnalysisStatistics.md)

Defined in: [src/impact-analyzer/types.ts:247](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L247)

Analysis statistics
