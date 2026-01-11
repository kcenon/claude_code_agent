[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactCurrentState

# Interface: ImpactCurrentState

Defined in: [src/impact-analyzer/types.ts:269](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L269)

Current state from Document Reader

## Properties

### project

> `readonly` **project**: `object`

Defined in: [src/impact-analyzer/types.ts:270](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L270)

#### name

> `readonly` **name**: `string`

#### version

> `readonly` **version**: `string`

#### lastUpdated?

> `readonly` `optional` **lastUpdated**: `string`

***

### requirements?

> `readonly` `optional` **requirements**: `object`

Defined in: [src/impact-analyzer/types.ts:275](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L275)

#### functional?

> `readonly` `optional` **functional**: readonly `object`[]

#### nonFunctional?

> `readonly` `optional` **nonFunctional**: readonly `object`[]

***

### features?

> `readonly` `optional` **features**: readonly `object`[]

Defined in: [src/impact-analyzer/types.ts:290](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L290)

***

### components?

> `readonly` `optional` **components**: readonly `object`[]

Defined in: [src/impact-analyzer/types.ts:296](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L296)

***

### traceability?

> `readonly` `optional` **traceability**: `object`

Defined in: [src/impact-analyzer/types.ts:304](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L304)

#### prdToSrs?

> `readonly` `optional` **prdToSrs**: readonly `object`[]

#### srsToSds?

> `readonly` `optional` **srsToSds**: readonly `object`[]
