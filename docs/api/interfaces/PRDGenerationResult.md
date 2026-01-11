[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PRDGenerationResult

# Interface: PRDGenerationResult

Defined in: [src/prd-writer/types.ts:245](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L245)

PRD generation result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/prd-writer/types.ts:247](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L247)

Whether generation was successful

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/prd-writer/types.ts:249](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L249)

Project ID

***

### scratchpadPath

> `readonly` **scratchpadPath**: `string`

Defined in: [src/prd-writer/types.ts:251](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L251)

Path to the generated PRD in scratchpad

***

### publicPath

> `readonly` **publicPath**: `string`

Defined in: [src/prd-writer/types.ts:253](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L253)

Path to the public PRD document

***

### generatedPRD

> `readonly` **generatedPRD**: [`GeneratedPRD`](GeneratedPRD.md)

Defined in: [src/prd-writer/types.ts:255](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L255)

Generated PRD content

***

### stats

> `readonly` **stats**: [`PRDGenerationStats`](PRDGenerationStats.md)

Defined in: [src/prd-writer/types.ts:257](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L257)

Generation statistics
