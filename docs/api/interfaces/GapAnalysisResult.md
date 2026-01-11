[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GapAnalysisResult

# Interface: GapAnalysisResult

Defined in: [src/prd-writer/types.ts:83](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L83)

Gap analysis result

## Properties

### totalGaps

> `readonly` **totalGaps**: `number`

Defined in: [src/prd-writer/types.ts:85](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L85)

Total number of gaps found

***

### criticalGaps

> `readonly` **criticalGaps**: readonly [`GapItem`](GapItem.md)[]

Defined in: [src/prd-writer/types.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L87)

Critical gaps that must be addressed

***

### majorGaps

> `readonly` **majorGaps**: readonly [`GapItem`](GapItem.md)[]

Defined in: [src/prd-writer/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L89)

Major gaps that should be addressed

***

### minorGaps

> `readonly` **minorGaps**: readonly [`GapItem`](GapItem.md)[]

Defined in: [src/prd-writer/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L91)

Minor gaps that are nice to address

***

### infoGaps

> `readonly` **infoGaps**: readonly [`GapItem`](GapItem.md)[]

Defined in: [src/prd-writer/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L93)

Informational gaps for improvement

***

### completenessScore

> `readonly` **completenessScore**: `number`

Defined in: [src/prd-writer/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L95)

Overall completeness score (0.0 - 1.0)

***

### sectionsWithGaps

> `readonly` **sectionsWithGaps**: readonly [`PRDSection`](../type-aliases/PRDSection.md)[]

Defined in: [src/prd-writer/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L97)

Sections with gaps
