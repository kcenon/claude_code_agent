[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRDWriterAgent

# Class: PRDWriterAgent

Defined in: [src/prd-writer/PRDWriterAgent.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L53)

PRDWriterAgent class for generating PRD documents

## Constructors

### Constructor

> **new PRDWriterAgent**(`config`): `PRDWriterAgent`

Defined in: [src/prd-writer/PRDWriterAgent.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L61)

#### Parameters

##### config

[`PRDWriterAgentConfig`](../interfaces/PRDWriterAgentConfig.md) = `{}`

#### Returns

`PRDWriterAgent`

## Methods

### getSession()

> **getSession**(): [`PRDGenerationSession`](../interfaces/PRDGenerationSession.md) \| `null`

Defined in: [src/prd-writer/PRDWriterAgent.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L93)

Get the current session

#### Returns

[`PRDGenerationSession`](../interfaces/PRDGenerationSession.md) \| `null`

Current session or null if none active

***

### startSession()

> **startSession**(`projectId`): `Promise`\<[`PRDGenerationSession`](../interfaces/PRDGenerationSession.md)\>

Defined in: [src/prd-writer/PRDWriterAgent.ts:103](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L103)

Start a new PRD generation session for a project

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`PRDGenerationSession`](../interfaces/PRDGenerationSession.md)\>

The created session

***

### analyzeGaps()

> **analyzeGaps**(): [`GapAnalysisResult`](../interfaces/GapAnalysisResult.md)

Defined in: [src/prd-writer/PRDWriterAgent.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L135)

Analyze the collected info for gaps

#### Returns

[`GapAnalysisResult`](../interfaces/GapAnalysisResult.md)

Gap analysis result

***

### checkConsistency()

> **checkConsistency**(): [`ConsistencyCheckResult`](../interfaces/ConsistencyCheckResult.md)

Defined in: [src/prd-writer/PRDWriterAgent.ts:160](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L160)

Check the collected info for consistency

#### Returns

[`ConsistencyCheckResult`](../interfaces/ConsistencyCheckResult.md)

Consistency check result

***

### generate()

> **generate**(): [`GeneratedPRD`](../interfaces/GeneratedPRD.md)

Defined in: [src/prd-writer/PRDWriterAgent.ts:179](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L179)

Generate the PRD document

#### Returns

[`GeneratedPRD`](../interfaces/GeneratedPRD.md)

Generated PRD

***

### finalize()

> **finalize**(): `Promise`\<[`PRDGenerationResult`](../interfaces/PRDGenerationResult.md)\>

Defined in: [src/prd-writer/PRDWriterAgent.ts:253](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L253)

Finalize the PRD generation and save to files

#### Returns

`Promise`\<[`PRDGenerationResult`](../interfaces/PRDGenerationResult.md)\>

PRD generation result

***

### generateFromProject()

> **generateFromProject**(`projectId`): `Promise`\<[`PRDGenerationResult`](../interfaces/PRDGenerationResult.md)\>

Defined in: [src/prd-writer/PRDWriterAgent.ts:309](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L309)

Generate PRD from project ID in one call

#### Parameters

##### projectId

`string`

Project identifier

#### Returns

`Promise`\<[`PRDGenerationResult`](../interfaces/PRDGenerationResult.md)\>

PRD generation result

***

### generateFromCollectedInfo()

> **generateFromCollectedInfo**(`collectedInfo`): `Promise`\<[`PRDGenerationResult`](../interfaces/PRDGenerationResult.md)\>

Defined in: [src/prd-writer/PRDWriterAgent.ts:322](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L322)

Generate PRD directly from collected info

#### Parameters

##### collectedInfo

The collected information

###### schemaVersion

`string` = `...`

###### projectId

`string` = `...`

###### status

`"completed"` \| `"collecting"` \| `"clarifying"` = `CollectionStatusSchema`

###### project

\{ `name`: `string`; `description`: `string`; \} = `...`

###### project.name

`string` = `...`

###### project.description

`string` = `...`

###### requirements

\{ `functional`: `object`[]; `nonFunctional`: `object`[]; \} = `...`

###### requirements.functional

`object`[] = `...`

###### requirements.nonFunctional

`object`[] = `...`

###### constraints

`object`[] = `...`

###### assumptions

`object`[] = `...`

###### dependencies

`object`[] = `...`

###### clarifications

`object`[] = `...`

###### sources

`object`[] = `...`

###### createdAt

`string` = `...`

###### updatedAt

`string` = `...`

###### completedAt?

`string` = `...`

#### Returns

`Promise`\<[`PRDGenerationResult`](../interfaces/PRDGenerationResult.md)\>

PRD generation result

***

### reset()

> **reset**(): `void`

Defined in: [src/prd-writer/PRDWriterAgent.ts:385](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L385)

Reset the agent, clearing the current session

#### Returns

`void`

***

### calculateQualityMetrics()

> **calculateQualityMetrics**(): `QualityMetrics`

Defined in: [src/prd-writer/PRDWriterAgent.ts:433](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/PRDWriterAgent.ts#L433)

Calculate quality metrics for the current session

#### Returns

`QualityMetrics`

Quality metrics
