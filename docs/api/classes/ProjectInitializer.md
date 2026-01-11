[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ProjectInitializer

# Class: ProjectInitializer

Defined in: [src/init/ProjectInitializer.ts:30](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/ProjectInitializer.ts#L30)

Handles project initialization and scaffolding

## Constructors

### Constructor

> **new ProjectInitializer**(`options`): `ProjectInitializer`

Defined in: [src/init/ProjectInitializer.ts:33](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/ProjectInitializer.ts#L33)

#### Parameters

##### options

[`InitOptions`](../interfaces/InitOptions.md)

#### Returns

`ProjectInitializer`

## Methods

### initialize()

> **initialize**(): `Promise`\<[`InitResult`](../interfaces/InitResult.md)\>

Defined in: [src/init/ProjectInitializer.ts:43](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/ProjectInitializer.ts#L43)

Initialize a new AD-SDLC project

#### Returns

`Promise`\<[`InitResult`](../interfaces/InitResult.md)\>

***

### getTemplateConfig()

> **getTemplateConfig**(`template`): [`TemplateConfig`](../interfaces/TemplateConfig.md)

Defined in: [src/init/ProjectInitializer.ts:823](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/ProjectInitializer.ts#L823)

Get template configuration

#### Parameters

##### template

[`TemplateType`](../type-aliases/TemplateType.md)

#### Returns

[`TemplateConfig`](../interfaces/TemplateConfig.md)
