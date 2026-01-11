[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RegressionTesterAgent

# Class: RegressionTesterAgent

Defined in: [src/regression-tester/RegressionTesterAgent.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/RegressionTesterAgent.ts#L62)

Regression Tester Agent class

## Constructors

### Constructor

> **new RegressionTesterAgent**(`config?`): `RegressionTesterAgent`

Defined in: [src/regression-tester/RegressionTesterAgent.ts:66](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/RegressionTesterAgent.ts#L66)

#### Parameters

##### config?

[`RegressionTesterConfig`](../interfaces/RegressionTesterConfig.md)

#### Returns

`RegressionTesterAgent`

## Methods

### getConfig()

> **getConfig**(): `Required`\<[`RegressionTesterConfig`](../interfaces/RegressionTesterConfig.md)\>

Defined in: [src/regression-tester/RegressionTesterAgent.ts:76](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/RegressionTesterAgent.ts#L76)

Get current configuration

#### Returns

`Required`\<[`RegressionTesterConfig`](../interfaces/RegressionTesterConfig.md)\>

***

### getCurrentSession()

> **getCurrentSession**(): [`RegressionTesterSession`](../interfaces/RegressionTesterSession.md) \| `null`

Defined in: [src/regression-tester/RegressionTesterAgent.ts:83](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/RegressionTesterAgent.ts#L83)

Get current session

#### Returns

[`RegressionTesterSession`](../interfaces/RegressionTesterSession.md) \| `null`

***

### startSession()

> **startSession**(`projectId`, `projectPath`, `changedFiles`): `Promise`\<[`RegressionTesterSession`](../interfaces/RegressionTesterSession.md)\>

Defined in: [src/regression-tester/RegressionTesterAgent.ts:90](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/RegressionTesterAgent.ts#L90)

Start a new regression testing session

#### Parameters

##### projectId

`string`

##### projectPath

`string`

##### changedFiles

readonly [`ChangedFile`](../interfaces/ChangedFile.md)[]

#### Returns

`Promise`\<[`RegressionTesterSession`](../interfaces/RegressionTesterSession.md)\>

***

### analyze()

> **analyze**(): `Promise`\<[`RegressionAnalysisResult`](../interfaces/RegressionAnalysisResult.md)\>

Defined in: [src/regression-tester/RegressionTesterAgent.ts:133](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/regression-tester/RegressionTesterAgent.ts#L133)

Run complete regression analysis

#### Returns

`Promise`\<[`RegressionAnalysisResult`](../interfaces/RegressionAnalysisResult.md)\>
