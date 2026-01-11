[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TemplateConfig

# Interface: TemplateConfig

Defined in: [src/init/types.ts:54](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L54)

Template configuration for different project variants

## Properties

### agents

> `readonly` **agents**: `"default"`

Defined in: [src/init/types.ts:56](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L56)

Agent configuration set

***

### qualityGates

> `readonly` **qualityGates**: [`QualityGateLevel`](../type-aliases/QualityGateLevel.md)

Defined in: [src/init/types.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L59)

Quality gate level

***

### parallelWorkers

> `readonly` **parallelWorkers**: `number`

Defined in: [src/init/types.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L62)

Number of parallel workers

***

### extraFeatures

> `readonly` **extraFeatures**: readonly `string`[]

Defined in: [src/init/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L65)

Additional features enabled
