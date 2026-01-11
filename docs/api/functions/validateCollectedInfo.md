[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / validateCollectedInfo

# Function: validateCollectedInfo()

> **validateCollectedInfo**(`data`): [`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `projectId`: `string`; `status`: `"completed"` \| `"collecting"` \| `"clarifying"`; `project`: \{ `name`: `string`; `description`: `string`; \}; `requirements`: \{ `functional`: `object`[]; `nonFunctional`: `object`[]; \}; `constraints`: `object`[]; `assumptions`: `object`[]; `dependencies`: `object`[]; `clarifications`: `object`[]; `sources`: `object`[]; `createdAt`: `string`; `updatedAt`: `string`; `completedAt?`: `string`; \}\>

Defined in: [src/scratchpad/validation.ts:129](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/validation.ts#L129)

Validate CollectedInfo data

## Parameters

### data

`unknown`

Data to validate

## Returns

[`SchemaValidationResult`](../interfaces/SchemaValidationResult.md)\<\{ `schemaVersion`: `string`; `projectId`: `string`; `status`: `"completed"` \| `"collecting"` \| `"clarifying"`; `project`: \{ `name`: `string`; `description`: `string`; \}; `requirements`: \{ `functional`: `object`[]; `nonFunctional`: `object`[]; \}; `constraints`: `object`[]; `assumptions`: `object`[]; `dependencies`: `object`[]; `clarifications`: `object`[]; `sources`: `object`[]; `createdAt`: `string`; `updatedAt`: `string`; `completedAt?`: `string`; \}\>

Validation result

## Example

```typescript
const result = validateCollectedInfo({
  projectId: '001',
  status: 'collecting',
  project: { name: 'My Project', description: 'Description' },
  // ...
});

if (result.success) {
  console.log('Valid:', result.data);
} else {
  console.error('Errors:', result.errors);
}
```
