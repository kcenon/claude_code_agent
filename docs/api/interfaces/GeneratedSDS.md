[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GeneratedSDS

# Interface: GeneratedSDS

Defined in: [src/sds-writer/types.ts:681](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L681)

Generated SDS document

## Properties

### metadata

> `readonly` **metadata**: [`SDSMetadata`](SDSMetadata.md)

Defined in: [src/sds-writer/types.ts:683](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L683)

SDS metadata

***

### content

> `readonly` **content**: `string`

Defined in: [src/sds-writer/types.ts:685](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L685)

Raw markdown content

***

### components

> `readonly` **components**: readonly [`SDSComponent`](SDSComponent.md)[]

Defined in: [src/sds-writer/types.ts:687](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L687)

Components in the SDS

***

### technologyStack

> `readonly` **technologyStack**: readonly [`TechnologyEntry`](TechnologyEntry.md)[]

Defined in: [src/sds-writer/types.ts:689](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L689)

Technology stack

***

### apis

> `readonly` **apis**: readonly [`SDSAPIEndpoint`](SDSAPIEndpoint.md)[]

Defined in: [src/sds-writer/types.ts:691](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L691)

API endpoints

***

### dataModels

> `readonly` **dataModels**: readonly [`DataModel`](DataModel.md)[]

Defined in: [src/sds-writer/types.ts:693](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L693)

Data models

***

### security?

> `readonly` `optional` **security**: [`SecuritySpec`](SecuritySpec.md)

Defined in: [src/sds-writer/types.ts:695](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L695)

Security specification

***

### deployment?

> `readonly` `optional` **deployment**: [`DeploymentSpec`](DeploymentSpec.md)

Defined in: [src/sds-writer/types.ts:697](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L697)

Deployment specification

***

### traceabilityMatrix

> `readonly` **traceabilityMatrix**: [`SDSTraceabilityMatrix`](SDSTraceabilityMatrix.md)

Defined in: [src/sds-writer/types.ts:699](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L699)

Traceability matrix
