[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SRSWriterAgentConfig

# Interface: SRSWriterAgentConfig

Defined in: [src/srs-writer/types.ts:278](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L278)

SRS Writer Agent configuration options

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/srs-writer/types.ts:280](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L280)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### templatePath?

> `readonly` `optional` **templatePath**: `string`

Defined in: [src/srs-writer/types.ts:282](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L282)

Path to SRS template (defaults to .ad-sdlc/templates/srs-template.md)

***

### publicDocsPath?

> `readonly` `optional` **publicDocsPath**: `string`

Defined in: [src/srs-writer/types.ts:284](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L284)

Output directory for public SRS docs

***

### minUseCasesPerFeature?

> `readonly` `optional` **minUseCasesPerFeature**: `number`

Defined in: [src/srs-writer/types.ts:286](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L286)

Minimum use cases per feature

***

### failOnLowCoverage?

> `readonly` `optional` **failOnLowCoverage**: `boolean`

Defined in: [src/srs-writer/types.ts:288](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L288)

Whether to fail on coverage below threshold

***

### coverageThreshold?

> `readonly` `optional` **coverageThreshold**: `number`

Defined in: [src/srs-writer/types.ts:290](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L290)

Minimum coverage threshold (0-100)

***

### includeTraceability?

> `readonly` `optional` **includeTraceability**: `boolean`

Defined in: [src/srs-writer/types.ts:292](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/srs-writer/types.ts#L292)

Include traceability matrix in output
