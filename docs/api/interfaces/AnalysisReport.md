[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AnalysisReport

# Interface: AnalysisReport

Defined in: [src/analysis-orchestrator/types.ts:185](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L185)

Final analysis report

## Properties

### analysisId

> `readonly` **analysisId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:187](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L187)

Analysis identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:189](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L189)

Project identifier

***

### generatedAt

> `readonly` **generatedAt**: `string`

Defined in: [src/analysis-orchestrator/types.ts:191](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L191)

Report generation timestamp

***

### analysisVersion

> `readonly` **analysisVersion**: `string`

Defined in: [src/analysis-orchestrator/types.ts:193](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L193)

Analysis version

***

### overallStatus

> `readonly` **overallStatus**: [`AnalysisResultStatus`](../type-aliases/AnalysisResultStatus.md)

Defined in: [src/analysis-orchestrator/types.ts:195](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L195)

Overall result status

***

### scope

> `readonly` **scope**: [`AnalysisScope`](../type-aliases/AnalysisScope.md)

Defined in: [src/analysis-orchestrator/types.ts:197](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L197)

Analysis scope used

***

### totalStages

> `readonly` **totalStages**: `number`

Defined in: [src/analysis-orchestrator/types.ts:199](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L199)

Total stages executed

***

### completedStages

> `readonly` **completedStages**: `number`

Defined in: [src/analysis-orchestrator/types.ts:201](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L201)

Stages completed successfully

***

### documentAnalysis

> `readonly` **documentAnalysis**: [`DocumentAnalysisSummary`](DocumentAnalysisSummary.md)

Defined in: [src/analysis-orchestrator/types.ts:203](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L203)

Document analysis summary

***

### codeAnalysis

> `readonly` **codeAnalysis**: [`CodeAnalysisSummary`](CodeAnalysisSummary.md)

Defined in: [src/analysis-orchestrator/types.ts:205](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L205)

Code analysis summary

***

### comparison

> `readonly` **comparison**: [`ComparisonSummary`](ComparisonSummary.md)

Defined in: [src/analysis-orchestrator/types.ts:207](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L207)

Comparison summary

***

### issues

> `readonly` **issues**: [`IssuesSummary`](IssuesSummary.md)

Defined in: [src/analysis-orchestrator/types.ts:209](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L209)

Issue generation summary

***

### recommendations

> `readonly` **recommendations**: readonly [`AnalysisRecommendation`](AnalysisRecommendation.md)[]

Defined in: [src/analysis-orchestrator/types.ts:211](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L211)

Recommendations for follow-up

***

### totalDurationMs

> `readonly` **totalDurationMs**: `number`

Defined in: [src/analysis-orchestrator/types.ts:213](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L213)

Total execution duration in milliseconds
