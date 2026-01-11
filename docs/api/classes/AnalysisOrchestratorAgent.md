[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AnalysisOrchestratorAgent

# Class: AnalysisOrchestratorAgent

Defined in: [src/analysis-orchestrator/AnalysisOrchestratorAgent.ts:204](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/AnalysisOrchestratorAgent.ts#L204)

Analysis Orchestrator Agent class

Responsible for:
- Initializing and managing analysis sessions
- Coordinating sub-agent execution
- Managing pipeline state and progress
- Generating analysis reports
- Handling errors and retries

## Constructors

### Constructor

> **new AnalysisOrchestratorAgent**(`config`): `AnalysisOrchestratorAgent`

Defined in: [src/analysis-orchestrator/AnalysisOrchestratorAgent.ts:213](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/AnalysisOrchestratorAgent.ts#L213)

#### Parameters

##### config

[`AnalysisOrchestratorConfig`](../interfaces/AnalysisOrchestratorConfig.md) = `{}`

#### Returns

`AnalysisOrchestratorAgent`

## Methods

### startAnalysis()

> **startAnalysis**(`input`): `Promise`\<[`AnalysisSession`](../interfaces/AnalysisSession.md)\>

Defined in: [src/analysis-orchestrator/AnalysisOrchestratorAgent.ts:232](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/AnalysisOrchestratorAgent.ts#L232)

Start a new analysis session

#### Parameters

##### input

[`AnalysisInput`](../interfaces/AnalysisInput.md)

#### Returns

`Promise`\<[`AnalysisSession`](../interfaces/AnalysisSession.md)\>

***

### execute()

> **execute**(): `Promise`\<[`AnalysisResult`](../interfaces/AnalysisResult.md)\>

Defined in: [src/analysis-orchestrator/AnalysisOrchestratorAgent.ts:295](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/AnalysisOrchestratorAgent.ts#L295)

Execute the analysis pipeline

#### Returns

`Promise`\<[`AnalysisResult`](../interfaces/AnalysisResult.md)\>

***

### getSession()

> **getSession**(): [`AnalysisSession`](../interfaces/AnalysisSession.md) \| `null`

Defined in: [src/analysis-orchestrator/AnalysisOrchestratorAgent.ts:424](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/AnalysisOrchestratorAgent.ts#L424)

Get current session

#### Returns

[`AnalysisSession`](../interfaces/AnalysisSession.md) \| `null`

***

### getStatus()

> **getStatus**(`analysisId`, `rootPath`): `Promise`\<[`PipelineState`](../interfaces/PipelineState.md)\>

Defined in: [src/analysis-orchestrator/AnalysisOrchestratorAgent.ts:431](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/AnalysisOrchestratorAgent.ts#L431)

Get analysis status by ID

#### Parameters

##### analysisId

`string`

##### rootPath

`string`

#### Returns

`Promise`\<[`PipelineState`](../interfaces/PipelineState.md)\>

***

### resume()

> **resume**(`analysisId`, `rootPath`, `retryFailed`): `Promise`\<[`AnalysisSession`](../interfaces/AnalysisSession.md)\>

Defined in: [src/analysis-orchestrator/AnalysisOrchestratorAgent.ts:459](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/AnalysisOrchestratorAgent.ts#L459)

Resume a failed analysis

#### Parameters

##### analysisId

`string`

##### rootPath

`string`

##### retryFailed

`boolean` = `true`

#### Returns

`Promise`\<[`AnalysisSession`](../interfaces/AnalysisSession.md)\>
