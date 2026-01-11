[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DataDesignResult

# Interface: DataDesignResult

Defined in: [src/sds-writer/DataDesigner.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L46)

Data design result

## Properties

### models

> `readonly` **models**: readonly [`DataModel`](DataModel.md)[]

Defined in: [src/sds-writer/DataDesigner.ts:48](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L48)

Designed data models

***

### failedComponents

> `readonly` **failedComponents**: readonly `string`[]

Defined in: [src/sds-writer/DataDesigner.ts:50](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L50)

Components that could not be processed

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/sds-writer/DataDesigner.ts:52](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/DataDesigner.ts#L52)

Design warnings
