[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRDGenerationSession

# Interface: PRDGenerationSession

Defined in: [src/prd-writer/types.ts:219](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L219)

PRD generation session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/prd-writer/types.ts:221](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L221)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/prd-writer/types.ts:223](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L223)

Project identifier

***

### status

> `readonly` **status**: [`PRDGenerationStatus`](../type-aliases/PRDGenerationStatus.md)

Defined in: [src/prd-writer/types.ts:225](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L225)

Current generation status

***

### collectedInfo

> `readonly` **collectedInfo**: `object`

Defined in: [src/prd-writer/types.ts:227](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L227)

Collected info input

#### schemaVersion

> **schemaVersion**: `string`

#### projectId

> **projectId**: `string`

#### status

> **status**: `"completed"` \| `"collecting"` \| `"clarifying"` = `CollectionStatusSchema`

#### project

> **project**: `object`

##### project.name

> **name**: `string`

##### project.description

> **description**: `string`

#### requirements

> **requirements**: `object`

##### requirements.functional

> **functional**: `object`[]

##### requirements.nonFunctional

> **nonFunctional**: `object`[]

#### constraints

> **constraints**: `object`[]

#### assumptions

> **assumptions**: `object`[]

#### dependencies

> **dependencies**: `object`[]

#### clarifications

> **clarifications**: `object`[]

#### sources

> **sources**: `object`[]

#### createdAt

> **createdAt**: `string`

#### updatedAt

> **updatedAt**: `string`

#### completedAt?

> `optional` **completedAt**: `string`

***

### gapAnalysis?

> `readonly` `optional` **gapAnalysis**: [`GapAnalysisResult`](GapAnalysisResult.md)

Defined in: [src/prd-writer/types.ts:229](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L229)

Gap analysis result

***

### consistencyCheck?

> `readonly` `optional` **consistencyCheck**: [`ConsistencyCheckResult`](ConsistencyCheckResult.md)

Defined in: [src/prd-writer/types.ts:231](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L231)

Consistency check result

***

### generatedPRD?

> `readonly` `optional` **generatedPRD**: [`GeneratedPRD`](GeneratedPRD.md)

Defined in: [src/prd-writer/types.ts:233](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L233)

Generated PRD (when completed)

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/prd-writer/types.ts:235](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L235)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/prd-writer/types.ts:237](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L237)

Session last update time

***

### errorMessage?

> `readonly` `optional` **errorMessage**: `string`

Defined in: [src/prd-writer/types.ts:239](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L239)

Error message if failed
