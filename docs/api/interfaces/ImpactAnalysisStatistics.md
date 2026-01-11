[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactAnalysisStatistics

# Interface: ImpactAnalysisStatistics

Defined in: [src/impact-analyzer/types.ts:205](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L205)

Analysis statistics

## Properties

### totalAffectedComponents

> `readonly` **totalAffectedComponents**: `number`

Defined in: [src/impact-analyzer/types.ts:207](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L207)

Total number of affected components

***

### totalAffectedFiles

> `readonly` **totalAffectedFiles**: `number`

Defined in: [src/impact-analyzer/types.ts:209](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L209)

Total number of affected files

***

### totalAffectedRequirements

> `readonly` **totalAffectedRequirements**: `number`

Defined in: [src/impact-analyzer/types.ts:211](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L211)

Total number of affected requirements

***

### directImpacts

> `readonly` **directImpacts**: `number`

Defined in: [src/impact-analyzer/types.ts:213](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L213)

Number of direct impacts

***

### indirectImpacts

> `readonly` **indirectImpacts**: `number`

Defined in: [src/impact-analyzer/types.ts:215](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L215)

Number of indirect impacts

***

### analysisDurationMs

> `readonly` **analysisDurationMs**: `number`

Defined in: [src/impact-analyzer/types.ts:217](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L217)

Analysis processing time in milliseconds
