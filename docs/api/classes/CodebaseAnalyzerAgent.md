[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodebaseAnalyzerAgent

# Class: CodebaseAnalyzerAgent

Defined in: [src/codebase-analyzer/CodebaseAnalyzerAgent.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/CodebaseAnalyzerAgent.ts#L71)

Codebase Analyzer Agent class

Responsible for:
- Analyzing project directory structure
- Detecting build systems and package managers
- Building module dependency graphs
- Identifying architecture and design patterns
- Detecting coding conventions
- Calculating code metrics

## Constructors

### Constructor

> **new CodebaseAnalyzerAgent**(`config`): `CodebaseAnalyzerAgent`

Defined in: [src/codebase-analyzer/CodebaseAnalyzerAgent.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/CodebaseAnalyzerAgent.ts#L75)

#### Parameters

##### config

[`CodebaseAnalyzerConfig`](../interfaces/CodebaseAnalyzerConfig.md) = `{}`

#### Returns

`CodebaseAnalyzerAgent`

## Methods

### startSession()

> **startSession**(`projectId`, `rootPath`): `Promise`\<[`CodebaseAnalysisSession`](../interfaces/CodebaseAnalysisSession.md)\>

Defined in: [src/codebase-analyzer/CodebaseAnalyzerAgent.ts:82](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/CodebaseAnalyzerAgent.ts#L82)

Start a new analysis session

#### Parameters

##### projectId

`string`

##### rootPath

`string`

#### Returns

`Promise`\<[`CodebaseAnalysisSession`](../interfaces/CodebaseAnalysisSession.md)\>

***

### analyze()

> **analyze**(): `Promise`\<[`CodebaseAnalysisResult`](../interfaces/CodebaseAnalysisResult.md)\>

Defined in: [src/codebase-analyzer/CodebaseAnalyzerAgent.ts:117](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/CodebaseAnalyzerAgent.ts#L117)

Analyze the codebase and generate outputs

#### Returns

`Promise`\<[`CodebaseAnalysisResult`](../interfaces/CodebaseAnalysisResult.md)\>

***

### getSession()

> **getSession**(): [`CodebaseAnalysisSession`](../interfaces/CodebaseAnalysisSession.md) \| `null`

Defined in: [src/codebase-analyzer/CodebaseAnalyzerAgent.ts:249](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/CodebaseAnalyzerAgent.ts#L249)

Get current session

#### Returns

[`CodebaseAnalysisSession`](../interfaces/CodebaseAnalysisSession.md) \| `null`

***

### resetSession()

> **resetSession**(): `void`

Defined in: [src/codebase-analyzer/CodebaseAnalyzerAgent.ts:256](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/CodebaseAnalyzerAgent.ts#L256)

Reset the session

#### Returns

`void`
