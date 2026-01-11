[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / WorkflowConfig

# Interface: WorkflowConfig

Defined in: [src/init/types.ts:204](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L204)

Workflow configuration structure

## Properties

### version

> `readonly` **version**: `string`

Defined in: [src/init/types.ts:206](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L206)

Workflow version

***

### pipeline

> `readonly` **pipeline**: `object`

Defined in: [src/init/types.ts:209](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L209)

Pipeline configuration

#### stages

> `readonly` **stages**: readonly `object`[]

***

### quality\_gates

> `readonly` **quality\_gates**: [`QualityGateConfig`](QualityGateConfig.md)

Defined in: [src/init/types.ts:218](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L218)

Quality gates configuration

***

### execution

> `readonly` **execution**: `object`

Defined in: [src/init/types.ts:221](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L221)

Execution configuration

#### max\_parallel\_workers

> `readonly` **max\_parallel\_workers**: `number`

#### retry\_attempts

> `readonly` **retry\_attempts**: `number`

#### retry\_delay\_ms

> `readonly` **retry\_delay\_ms**: `number`
