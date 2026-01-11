[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InteractiveWizard

# Class: InteractiveWizard

Defined in: [src/init/InteractiveWizard.ts:34](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/InteractiveWizard.ts#L34)

Interactive wizard for gathering project configuration

## Constructors

### Constructor

> **new InteractiveWizard**(): `InteractiveWizard`

#### Returns

`InteractiveWizard`

## Methods

### run()

> **run**(): `Promise`\<[`InitOptions`](../interfaces/InitOptions.md)\>

Defined in: [src/init/InteractiveWizard.ts:38](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/InteractiveWizard.ts#L38)

Run the interactive wizard to gather project configuration

#### Returns

`Promise`\<[`InitOptions`](../interfaces/InitOptions.md)\>

***

### confirm()

> **confirm**(`message`): `Promise`\<`boolean`\>

Defined in: [src/init/InteractiveWizard.ts:122](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/InteractiveWizard.ts#L122)

Prompt for confirmation before proceeding

#### Parameters

##### message

`string`

#### Returns

`Promise`\<`boolean`\>

***

### confirmConfiguration()

> **confirmConfiguration**(`options`): `Promise`\<`boolean`\>

Defined in: [src/init/InteractiveWizard.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/InteractiveWizard.ts#L137)

Display a summary of the configuration and ask for confirmation

#### Parameters

##### options

[`InitOptions`](../interfaces/InitOptions.md)

#### Returns

`Promise`\<`boolean`\>
