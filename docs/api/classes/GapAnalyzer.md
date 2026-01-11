[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GapAnalyzer

# Class: GapAnalyzer

Defined in: [src/prd-writer/GapAnalyzer.ts:40](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/GapAnalyzer.ts#L40)

GapAnalyzer class for identifying missing information

## Constructors

### Constructor

> **new GapAnalyzer**(`options`): `GapAnalyzer`

Defined in: [src/prd-writer/GapAnalyzer.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/GapAnalyzer.ts#L44)

#### Parameters

##### options

[`GapAnalyzerOptions`](../interfaces/GapAnalyzerOptions.md) = `{}`

#### Returns

`GapAnalyzer`

## Methods

### analyze()

> **analyze**(`collectedInfo`): [`GapAnalysisResult`](../interfaces/GapAnalysisResult.md)

Defined in: [src/prd-writer/GapAnalyzer.ts:54](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/GapAnalyzer.ts#L54)

Analyze collected info for gaps

#### Parameters

##### collectedInfo

The collected information to analyze

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

[`GapAnalysisResult`](../interfaces/GapAnalysisResult.md)

Gap analysis result
