[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ComponentDesignResult

# Interface: ComponentDesignResult

Defined in: [src/sds-writer/ComponentDesigner.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/ComponentDesigner.ts#L47)

Component design result

## Properties

### components

> `readonly` **components**: readonly [`SDSComponent`](SDSComponent.md)[]

Defined in: [src/sds-writer/ComponentDesigner.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/ComponentDesigner.ts#L49)

Designed components

***

### failedFeatures

> `readonly` **failedFeatures**: readonly `string`[]

Defined in: [src/sds-writer/ComponentDesigner.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/ComponentDesigner.ts#L51)

Components that could not be designed

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/sds-writer/ComponentDesigner.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/ComponentDesigner.ts#L53)

Design warnings
