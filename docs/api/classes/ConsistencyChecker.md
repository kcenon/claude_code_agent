[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ConsistencyChecker

# Class: ConsistencyChecker

Defined in: [src/prd-writer/ConsistencyChecker.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/ConsistencyChecker.ts#L47)

ConsistencyChecker class for validating requirement consistency

## Constructors

### Constructor

> **new ConsistencyChecker**(`options`): `ConsistencyChecker`

Defined in: [src/prd-writer/ConsistencyChecker.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/ConsistencyChecker.ts#L51)

#### Parameters

##### options

[`ConsistencyCheckerOptions`](../interfaces/ConsistencyCheckerOptions.md) = `{}`

#### Returns

`ConsistencyChecker`

## Methods

### check()

> **check**(`collectedInfo`): [`ConsistencyCheckResult`](../interfaces/ConsistencyCheckResult.md)

Defined in: [src/prd-writer/ConsistencyChecker.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/ConsistencyChecker.ts#L61)

Check collected info for consistency issues

#### Parameters

##### collectedInfo

The collected information to check

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

[`ConsistencyCheckResult`](../interfaces/ConsistencyCheckResult.md)

Consistency check result
