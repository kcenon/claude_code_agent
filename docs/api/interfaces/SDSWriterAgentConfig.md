[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SDSWriterAgentConfig

# Interface: SDSWriterAgentConfig

Defined in: [src/sds-writer/types.ts:625](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L625)

SDS Writer Agent configuration options

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/sds-writer/types.ts:627](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L627)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### templatePath?

> `readonly` `optional` **templatePath**: `string`

Defined in: [src/sds-writer/types.ts:629](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L629)

Path to SDS template (defaults to .ad-sdlc/templates/sds-template.md)

***

### publicDocsPath?

> `readonly` `optional` **publicDocsPath**: `string`

Defined in: [src/sds-writer/types.ts:631](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L631)

Output directory for public SDS docs

***

### generateAPIs?

> `readonly` `optional` **generateAPIs**: `boolean`

Defined in: [src/sds-writer/types.ts:633](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L633)

Whether to generate API specifications

***

### generateDataModels?

> `readonly` `optional` **generateDataModels**: `boolean`

Defined in: [src/sds-writer/types.ts:635](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L635)

Whether to generate data models

***

### generateSecuritySpecs?

> `readonly` `optional` **generateSecuritySpecs**: `boolean`

Defined in: [src/sds-writer/types.ts:637](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L637)

Whether to generate security specifications

***

### failOnLowCoverage?

> `readonly` `optional` **failOnLowCoverage**: `boolean`

Defined in: [src/sds-writer/types.ts:639](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L639)

Whether to fail on low traceability coverage

***

### coverageThreshold?

> `readonly` `optional` **coverageThreshold**: `number`

Defined in: [src/sds-writer/types.ts:641](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L641)

Minimum traceability coverage threshold (0-100)

***

### includeTraceability?

> `readonly` `optional` **includeTraceability**: `boolean`

Defined in: [src/sds-writer/types.ts:643](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L643)

Include traceability matrix in output

***

### defaultTechnologyStack?

> `readonly` `optional` **defaultTechnologyStack**: readonly [`TechnologyEntry`](TechnologyEntry.md)[]

Defined in: [src/sds-writer/types.ts:645](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L645)

Default technology stack suggestions
