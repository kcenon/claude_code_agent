[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSGenerationStats

# Interface: SDSGenerationStats

Defined in: [src/sds-writer/types.ts:723](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L723)

Statistics about the SDS generation process

## Properties

### srsFeatureCount

> `readonly` **srsFeatureCount**: `number`

Defined in: [src/sds-writer/types.ts:725](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L725)

Number of SRS features processed

***

### componentsGenerated

> `readonly` **componentsGenerated**: `number`

Defined in: [src/sds-writer/types.ts:727](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L727)

Number of SDS components generated

***

### interfacesGenerated

> `readonly` **interfacesGenerated**: `number`

Defined in: [src/sds-writer/types.ts:729](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L729)

Number of interfaces generated

***

### apisGenerated

> `readonly` **apisGenerated**: `number`

Defined in: [src/sds-writer/types.ts:731](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L731)

Number of API endpoints generated

***

### dataModelsGenerated

> `readonly` **dataModelsGenerated**: `number`

Defined in: [src/sds-writer/types.ts:733](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L733)

Number of data models generated

***

### traceabilityCoverage

> `readonly` **traceabilityCoverage**: `number`

Defined in: [src/sds-writer/types.ts:735](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L735)

Traceability coverage percentage

***

### processingTimeMs

> `readonly` **processingTimeMs**: `number`

Defined in: [src/sds-writer/types.ts:737](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L737)

Total processing time in milliseconds
