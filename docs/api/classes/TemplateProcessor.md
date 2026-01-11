[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TemplateProcessor

# Class: TemplateProcessor

Defined in: [src/prd-writer/TemplateProcessor.ts:40](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/TemplateProcessor.ts#L40)

TemplateProcessor class for PRD template handling

## Constructors

### Constructor

> **new TemplateProcessor**(`options`): `TemplateProcessor`

Defined in: [src/prd-writer/TemplateProcessor.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/TemplateProcessor.ts#L44)

#### Parameters

##### options

[`TemplateProcessorOptions`](../interfaces/TemplateProcessorOptions.md) = `{}`

#### Returns

`TemplateProcessor`

## Methods

### loadTemplate()

> **loadTemplate**(): `string`

Defined in: [src/prd-writer/TemplateProcessor.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/TemplateProcessor.ts#L53)

Load the PRD template from file

#### Returns

`string`

The template content

***

### process()

> **process**(`collectedInfo`, `metadata`): [`PRDTemplateProcessingResult`](../interfaces/PRDTemplateProcessingResult.md)

Defined in: [src/prd-writer/TemplateProcessor.ts:78](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/TemplateProcessor.ts#L78)

Process the template with collected info

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

##### metadata

[`PRDMetadata`](../interfaces/PRDMetadata.md)

PRD metadata

#### Returns

[`PRDTemplateProcessingResult`](../interfaces/PRDTemplateProcessingResult.md)

Processed template result

***

### generateWithoutTemplate()

> **generateWithoutTemplate**(`collectedInfo`, `metadata`): `string`

Defined in: [src/prd-writer/TemplateProcessor.ts:133](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/TemplateProcessor.ts#L133)

Generate PRD content without using a template file

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

##### metadata

[`PRDMetadata`](../interfaces/PRDMetadata.md)

PRD metadata

#### Returns

`string`

Generated PRD markdown content
