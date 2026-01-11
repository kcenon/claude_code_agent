[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodeAnalysisSummary

# Interface: CodeAnalysisSummary

Defined in: [src/analysis-orchestrator/types.ts:127](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L127)

Code analysis summary

## Properties

### available

> `readonly` **available**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:129](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L129)

Whether code analysis is available

***

### summary

> `readonly` **summary**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:131](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L131)

Summary description

***

### outputPath

> `readonly` **outputPath**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:133](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L133)

Path to output file

***

### moduleCount

> `readonly` **moduleCount**: `number`

Defined in: [src/analysis-orchestrator/types.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L135)

Number of modules analyzed

***

### fileCount

> `readonly` **fileCount**: `number`

Defined in: [src/analysis-orchestrator/types.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L137)

Number of files analyzed

***

### totalLines

> `readonly` **totalLines**: `number`

Defined in: [src/analysis-orchestrator/types.ts:139](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L139)

Total lines of code
