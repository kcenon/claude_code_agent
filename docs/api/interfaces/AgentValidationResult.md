[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AgentValidationResult

# Interface: AgentValidationResult

Defined in: [src/agent-validator/types.ts:60](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/agent-validator/types.ts#L60)

Validation result for a single agent

## Properties

### filePath

> **filePath**: `string`

Defined in: [src/agent-validator/types.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/agent-validator/types.ts#L61)

***

### valid

> **valid**: `boolean`

Defined in: [src/agent-validator/types.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/agent-validator/types.ts#L62)

***

### errors

> **errors**: [`AgentValidationError`](AgentValidationError.md)[]

Defined in: [src/agent-validator/types.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/agent-validator/types.ts#L63)

***

### warnings

> **warnings**: [`AgentValidationError`](AgentValidationError.md)[]

Defined in: [src/agent-validator/types.ts:64](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/agent-validator/types.ts#L64)

***

### agent?

> `optional` **agent**: [`AgentDefinition`](AgentDefinition.md)

Defined in: [src/agent-validator/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/agent-validator/types.ts#L65)
