[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CollectionResult

# Interface: CollectionResult

Defined in: [src/collector/types.ts:246](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L246)

Result of a collection operation

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/collector/types.ts:248](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L248)

Whether collection was successful

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/collector/types.ts:250](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L250)

Project ID

***

### outputPath

> `readonly` **outputPath**: `string`

Defined in: [src/collector/types.ts:252](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L252)

Path to the collected_info.yaml file

***

### collectedInfo

> `readonly` **collectedInfo**: `object`

Defined in: [src/collector/types.ts:254](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L254)

The collected information

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

### remainingQuestions

> `readonly` **remainingQuestions**: readonly [`ClarificationQuestion`](ClarificationQuestion.md)[]

Defined in: [src/collector/types.ts:256](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L256)

Any remaining questions that weren't answered

***

### stats

> `readonly` **stats**: [`CollectionStats`](CollectionStats.md)

Defined in: [src/collector/types.ts:258](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/collector/types.ts#L258)

Collection statistics
