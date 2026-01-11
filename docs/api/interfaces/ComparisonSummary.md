[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComparisonSummary

# Interface: ComparisonSummary

Defined in: [src/analysis-orchestrator/types.ts:145](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L145)

Comparison summary

## Properties

### available

> `readonly` **available**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:147](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L147)

Whether comparison is available

***

### totalGaps

> `readonly` **totalGaps**: `number`

Defined in: [src/analysis-orchestrator/types.ts:149](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L149)

Total number of gaps found

***

### criticalGaps

> `readonly` **criticalGaps**: `number`

Defined in: [src/analysis-orchestrator/types.ts:151](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L151)

Number of critical gaps (P0)

***

### highGaps

> `readonly` **highGaps**: `number`

Defined in: [src/analysis-orchestrator/types.ts:153](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L153)

Number of high priority gaps (P1)

***

### outputPath

> `readonly` **outputPath**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:155](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L155)

Path to output file
