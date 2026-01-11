[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / validateWorkOrder

# Function: validateWorkOrder()

> **validateWorkOrder**(`data`): [`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `orderId`: `string`; `issueId`: `string`; `issueUrl`: `string`; `createdAt`: `string`; `priority`: `number`; `context`: \{ `sdsComponent?`: `string`; `srsFeature?`: `string`; `prdRequirement?`: `string`; `relatedFiles`: `object`[]; `dependenciesStatus`: `object`[]; \}; `acceptanceCriteria`: `string`[]; \}\>

Defined in: [src/scratchpad/validation.ts:149](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L149)

Validate WorkOrder data

## Parameters

### data

`unknown`

Data to validate

## Returns

[`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `orderId`: `string`; `issueId`: `string`; `issueUrl`: `string`; `createdAt`: `string`; `priority`: `number`; `context`: \{ `sdsComponent?`: `string`; `srsFeature?`: `string`; `prdRequirement?`: `string`; `relatedFiles`: `object`[]; `dependenciesStatus`: `object`[]; \}; `acceptanceCriteria`: `string`[]; \}\>

Validation result

## Example

```typescript
const result = validateWorkOrder({
  orderId: 'WO-001',
  issueId: '123',
  issueUrl: 'https://github.com/repo/issues/123',
  // ...
});
```
