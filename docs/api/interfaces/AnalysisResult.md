[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AnalysisResult

# Interface: AnalysisResult

Defined in: [src/analysis-orchestrator/types.ts:404](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L404)

Analysis result returned by orchestrator

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:406](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L406)

Whether analysis was successful

***

### analysisId

> `readonly` **analysisId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:408](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L408)

Analysis identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:410](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L410)

Project identifier

***

### pipelineState

> `readonly` **pipelineState**: [`PipelineState`](PipelineState.md)

Defined in: [src/analysis-orchestrator/types.ts:412](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L412)

Final pipeline state

***

### report

> `readonly` **report**: [`AnalysisReport`](AnalysisReport.md)

Defined in: [src/analysis-orchestrator/types.ts:414](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L414)

Analysis report

***

### outputPaths

> `readonly` **outputPaths**: `object`

Defined in: [src/analysis-orchestrator/types.ts:416](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L416)

Paths to all output files

#### pipelineState

> `readonly` **pipelineState**: `string`

#### analysisReport

> `readonly` **analysisReport**: `string`

#### documentInventory?

> `readonly` `optional` **documentInventory**: `string`

#### codeInventory?

> `readonly` `optional` **codeInventory**: `string`

#### comparisonResult?

> `readonly` `optional` **comparisonResult**: `string`

#### generatedIssues?

> `readonly` `optional` **generatedIssues**: `string`

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/analysis-orchestrator/types.ts:425](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L425)

Warnings during analysis
