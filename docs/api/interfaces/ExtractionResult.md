[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ExtractionResult

# Interface: ExtractionResult

Defined in: [src/collector/types.ts:178](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L178)

Result of information extraction

## Properties

### projectName?

> `readonly` `optional` **projectName**: `string`

Defined in: [src/collector/types.ts:180](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L180)

Project name (if detected)

***

### projectDescription?

> `readonly` `optional` **projectDescription**: `string`

Defined in: [src/collector/types.ts:182](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L182)

Project description (if detected)

***

### functionalRequirements

> `readonly` **functionalRequirements**: readonly [`ExtractedRequirement`](ExtractedRequirement.md)[]

Defined in: [src/collector/types.ts:184](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L184)

Extracted functional requirements

***

### nonFunctionalRequirements

> `readonly` **nonFunctionalRequirements**: readonly [`ExtractedRequirement`](ExtractedRequirement.md)[]

Defined in: [src/collector/types.ts:186](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L186)

Extracted non-functional requirements

***

### constraints

> `readonly` **constraints**: readonly [`ExtractedConstraint`](ExtractedConstraint.md)[]

Defined in: [src/collector/types.ts:188](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L188)

Extracted constraints

***

### assumptions

> `readonly` **assumptions**: readonly [`ExtractedAssumption`](ExtractedAssumption.md)[]

Defined in: [src/collector/types.ts:190](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L190)

Extracted assumptions

***

### dependencies

> `readonly` **dependencies**: readonly [`ExtractedDependency`](ExtractedDependency.md)[]

Defined in: [src/collector/types.ts:192](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L192)

Extracted dependencies

***

### clarificationQuestions

> `readonly` **clarificationQuestions**: readonly [`ClarificationQuestion`](ClarificationQuestion.md)[]

Defined in: [src/collector/types.ts:194](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L194)

Questions for unclear information

***

### overallConfidence

> `readonly` **overallConfidence**: `number`

Defined in: [src/collector/types.ts:196](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L196)

Overall extraction confidence

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/collector/types.ts:198](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L198)

Warnings during extraction
