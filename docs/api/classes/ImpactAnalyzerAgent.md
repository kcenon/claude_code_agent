[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactAnalyzerAgent

# Class: ImpactAnalyzerAgent

Defined in: [src/impact-analyzer/ImpactAnalyzerAgent.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/ImpactAnalyzerAgent.ts#L71)

Impact Analyzer Agent class

Responsible for:
- Loading and parsing inputs from Document Reader and Codebase Analyzer
- Analyzing change requests
- Identifying affected components and dependencies
- Assessing risk levels
- Predicting regression risks
- Generating comprehensive impact reports

## Constructors

### Constructor

> **new ImpactAnalyzerAgent**(`config`): `ImpactAnalyzerAgent`

Defined in: [src/impact-analyzer/ImpactAnalyzerAgent.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/ImpactAnalyzerAgent.ts#L75)

#### Parameters

##### config

[`ImpactAnalyzerConfig`](../interfaces/ImpactAnalyzerConfig.md) = `{}`

#### Returns

`ImpactAnalyzerAgent`

## Methods

### startSession()

> **startSession**(`projectId`, `changeRequest`): `Promise`\<[`ImpactAnalysisSession`](../interfaces/ImpactAnalysisSession.md)\>

Defined in: [src/impact-analyzer/ImpactAnalyzerAgent.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/ImpactAnalyzerAgent.ts#L89)

Start a new analysis session

#### Parameters

##### projectId

`string`

##### changeRequest

[`ChangeRequest`](../interfaces/ChangeRequest.md)

#### Returns

`Promise`\<[`ImpactAnalysisSession`](../interfaces/ImpactAnalysisSession.md)\>

***

### checkAvailableInputs()

> **checkAvailableInputs**(`projectId`, `rootPath`): `Promise`\<[`AvailableInputs`](../interfaces/AvailableInputs.md)\>

Defined in: [src/impact-analyzer/ImpactAnalyzerAgent.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/ImpactAnalyzerAgent.ts#L119)

Check available inputs for analysis

#### Parameters

##### projectId

`string`

##### rootPath

`string`

#### Returns

`Promise`\<[`AvailableInputs`](../interfaces/AvailableInputs.md)\>

***

### analyze()

> **analyze**(`rootPath`): `Promise`\<[`ImpactAnalysisResult`](../interfaces/ImpactAnalysisResult.md)\>

Defined in: [src/impact-analyzer/ImpactAnalyzerAgent.ts:152](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/ImpactAnalyzerAgent.ts#L152)

Analyze the change request and generate impact report

#### Parameters

##### rootPath

`string`

#### Returns

`Promise`\<[`ImpactAnalysisResult`](../interfaces/ImpactAnalysisResult.md)\>

***

### getSession()

> **getSession**(): [`ImpactAnalysisSession`](../interfaces/ImpactAnalysisSession.md) \| `null`

Defined in: [src/impact-analyzer/ImpactAnalyzerAgent.ts:329](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/ImpactAnalyzerAgent.ts#L329)

Get current session

#### Returns

[`ImpactAnalysisSession`](../interfaces/ImpactAnalysisSession.md) \| `null`

***

### parseChangeRequest()

> **parseChangeRequest**(`input`): [`ChangeRequest`](../interfaces/ChangeRequest.md)

Defined in: [src/impact-analyzer/ImpactAnalyzerAgent.ts:336](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/ImpactAnalyzerAgent.ts#L336)

Parse change request from text

#### Parameters

##### input

`string`

#### Returns

[`ChangeRequest`](../interfaces/ChangeRequest.md)
