[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CurrentState

# Interface: CurrentState

Defined in: [src/document-reader/types.ts:266](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L266)

Project current state

## Properties

### project

> `readonly` **project**: `object`

Defined in: [src/document-reader/types.ts:268](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L268)

Project information

#### name

> `readonly` **name**: `string`

#### version

> `readonly` **version**: `string`

#### lastUpdated

> `readonly` **lastUpdated**: `string`

***

### documents

> `readonly` **documents**: `object`

Defined in: [src/document-reader/types.ts:275](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L275)

Document information

#### prd?

> `readonly` `optional` **prd**: [`DocumentInfo`](DocumentInfo.md)

#### srs?

> `readonly` `optional` **srs**: [`DocumentInfo`](DocumentInfo.md)

#### sds?

> `readonly` `optional` **sds**: [`DocumentInfo`](DocumentInfo.md)

***

### requirements

> `readonly` **requirements**: `object`

Defined in: [src/document-reader/types.ts:282](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L282)

Extracted requirements

#### functional

> `readonly` **functional**: readonly [`DocReaderFunctionalRequirement`](DocReaderFunctionalRequirement.md)[]

#### nonFunctional

> `readonly` **nonFunctional**: readonly [`DocReaderNonFunctionalRequirement`](DocReaderNonFunctionalRequirement.md)[]

***

### features

> `readonly` **features**: readonly [`SystemFeature`](SystemFeature.md)[]

Defined in: [src/document-reader/types.ts:288](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L288)

Extracted features

***

### useCases

> `readonly` **useCases**: readonly [`DocReaderUseCase`](DocReaderUseCase.md)[]

Defined in: [src/document-reader/types.ts:291](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L291)

Extracted use cases

***

### components

> `readonly` **components**: readonly [`SystemComponent`](SystemComponent.md)[]

Defined in: [src/document-reader/types.ts:294](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L294)

Extracted components

***

### apis

> `readonly` **apis**: readonly [`APISpecification`](APISpecification.md)[]

Defined in: [src/document-reader/types.ts:297](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L297)

Extracted APIs

***

### traceability

> `readonly` **traceability**: `object`

Defined in: [src/document-reader/types.ts:300](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L300)

Traceability mappings

#### prdToSrs

> `readonly` **prdToSrs**: readonly [`PRDToSRSTrace`](PRDToSRSTrace.md)[]

#### srsToSds

> `readonly` **srsToSds**: readonly [`SRSToSDSTrace`](SRSToSDSTrace.md)[]

***

### statistics

> `readonly` **statistics**: `object`

Defined in: [src/document-reader/types.ts:306](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L306)

Coverage statistics

#### totalRequirements

> `readonly` **totalRequirements**: `number`

#### totalFeatures

> `readonly` **totalFeatures**: `number`

#### totalUseCases

> `readonly` **totalUseCases**: `number`

#### totalComponents

> `readonly` **totalComponents**: `number`

#### totalApis

> `readonly` **totalApis**: `number`

#### coveragePrdToSrs

> `readonly` **coveragePrdToSrs**: `number`

#### coverageSrsToSds

> `readonly` **coverageSrsToSds**: `number`
