[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DataProtectionMeasure

# Interface: DataProtectionMeasure

Defined in: [src/sds-writer/types.ts:541](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L541)

Data protection measure

## Properties

### type

> `readonly` **type**: `"encryption"` \| `"masking"` \| `"hashing"` \| `"tokenization"`

Defined in: [src/sds-writer/types.ts:543](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L543)

Measure type

***

### appliesTo

> `readonly` **appliesTo**: readonly `string`[]

Defined in: [src/sds-writer/types.ts:545](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L545)

Applies to

***

### method

> `readonly` **method**: `string`

Defined in: [src/sds-writer/types.ts:547](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L547)

Algorithm/method

***

### notes?

> `readonly` `optional` **notes**: `string`

Defined in: [src/sds-writer/types.ts:549](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/sds-writer/types.ts#L549)

Notes
