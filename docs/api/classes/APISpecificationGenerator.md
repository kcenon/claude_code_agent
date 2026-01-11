[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / APISpecificationGenerator

# Class: APISpecificationGenerator

Defined in: [src/component-generator/APISpecificationGenerator.ts:27](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/APISpecificationGenerator.ts#L27)

Generates API specifications and documentation

## Constructors

### Constructor

> **new APISpecificationGenerator**(): `APISpecificationGenerator`

#### Returns

`APISpecificationGenerator`

## Methods

### extractAPIEndpoints()

> **extractAPIEndpoints**(`components`): [`APIEndpoint`](../interfaces/APIEndpoint.md)[]

Defined in: [src/component-generator/APISpecificationGenerator.ts:31](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/APISpecificationGenerator.ts#L31)

Extract all API endpoints from components

#### Parameters

##### components

readonly [`ComponentDefinition`](../interfaces/ComponentDefinition.md)[]

#### Returns

[`APIEndpoint`](../interfaces/APIEndpoint.md)[]

***

### generateSpecificationTable()

> **generateSpecificationTable**(`endpoints`): `string`

Defined in: [src/component-generator/APISpecificationGenerator.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/APISpecificationGenerator.ts#L49)

Generate API specification table in markdown format

#### Parameters

##### endpoints

readonly [`APIEndpoint`](../interfaces/APIEndpoint.md)[]

#### Returns

`string`

***

### generateDetailedDocumentation()

> **generateDetailedDocumentation**(`endpoints`, `interfaces`): `string`

Defined in: [src/component-generator/APISpecificationGenerator.ts:74](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/APISpecificationGenerator.ts#L74)

Generate detailed API documentation in markdown format

#### Parameters

##### endpoints

readonly [`APIEndpoint`](../interfaces/APIEndpoint.md)[]

##### interfaces

readonly [`InterfaceSpec`](../interfaces/InterfaceSpec.md)[]

#### Returns

`string`

***

### generateOpenAPISpec()

> **generateOpenAPISpec**(`endpoints`, `title`, `version`): `string`

Defined in: [src/component-generator/APISpecificationGenerator.ts:126](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/APISpecificationGenerator.ts#L126)

Generate OpenAPI specification (YAML format)

#### Parameters

##### endpoints

readonly [`APIEndpoint`](../interfaces/APIEndpoint.md)[]

##### title

`string`

##### version

`string`

#### Returns

`string`

***

### generateTypeScriptInterfaces()

> **generateTypeScriptInterfaces**(`endpoints`): `string`

Defined in: [src/component-generator/APISpecificationGenerator.ts:155](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/component-generator/APISpecificationGenerator.ts#L155)

Generate TypeScript interface definitions from API endpoints

#### Parameters

##### endpoints

readonly [`APIEndpoint`](../interfaces/APIEndpoint.md)[]

#### Returns

`string`
