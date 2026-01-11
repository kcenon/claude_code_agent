[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRDGenerationStats

# Interface: PRDGenerationStats

Defined in: [src/prd-writer/types.ts:263](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L263)

Statistics about the PRD generation process

## Properties

### functionalRequirements

> `readonly` **functionalRequirements**: `number`

Defined in: [src/prd-writer/types.ts:265](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L265)

Number of functional requirements

***

### nonFunctionalRequirements

> `readonly` **nonFunctionalRequirements**: `number`

Defined in: [src/prd-writer/types.ts:267](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L267)

Number of non-functional requirements

***

### constraints

> `readonly` **constraints**: `number`

Defined in: [src/prd-writer/types.ts:269](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L269)

Number of constraints

***

### assumptions

> `readonly` **assumptions**: `number`

Defined in: [src/prd-writer/types.ts:271](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L271)

Number of assumptions

***

### dependencies

> `readonly` **dependencies**: `number`

Defined in: [src/prd-writer/types.ts:273](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L273)

Number of dependencies

***

### gapsFound

> `readonly` **gapsFound**: `number`

Defined in: [src/prd-writer/types.ts:275](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L275)

Number of gaps found

***

### consistencyIssues

> `readonly` **consistencyIssues**: `number`

Defined in: [src/prd-writer/types.ts:277](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L277)

Number of consistency issues found

***

### completenessScore

> `readonly` **completenessScore**: `number`

Defined in: [src/prd-writer/types.ts:279](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L279)

Completeness score

***

### qualityMetrics

> `readonly` **qualityMetrics**: `QualityMetrics`

Defined in: [src/prd-writer/types.ts:281](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L281)

Quality metrics

***

### processingTimeMs

> `readonly` **processingTimeMs**: `number`

Defined in: [src/prd-writer/types.ts:283](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L283)

Total processing time in milliseconds
