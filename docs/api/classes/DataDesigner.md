[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DataDesigner

# Class: DataDesigner

Defined in: [src/sds-writer/DataDesigner.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L58)

Designer for data models from components

## Constructors

### Constructor

> **new DataDesigner**(`options`): `DataDesigner`

Defined in: [src/sds-writer/DataDesigner.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L61)

#### Parameters

##### options

[`DataDesignerOptions`](../interfaces/DataDesignerOptions.md) = `{}`

#### Returns

`DataDesigner`

## Methods

### design()

> **design**(`components`, `features`): [`DataDesignResult`](../interfaces/DataDesignResult.md)

Defined in: [src/sds-writer/DataDesigner.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L71)

Design data models from components

#### Parameters

##### components

readonly [`SDSComponent`](../interfaces/SDSComponent.md)[]

SDS components

##### features

readonly [`ParsedSRSFeature`](../interfaces/ParsedSRSFeature.md)[]

Related features

#### Returns

[`DataDesignResult`](../interfaces/DataDesignResult.md)

Data design result

***

### designModel()

> **designModel**(`input`): [`DataModel`](../interfaces/DataModel.md) \| `null`

Defined in: [src/sds-writer/DataDesigner.ts:124](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L124)

Design a single data model from a component

#### Parameters

##### input

[`DataModelDesignInput`](../interfaces/DataModelDesignInput.md)

#### Returns

[`DataModel`](../interfaces/DataModel.md) \| `null`
